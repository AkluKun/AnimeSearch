const form = document.querySelector("#searchForm");
const input = document.querySelector("#searchInput");
const result = document.querySelector("#resultados");
const message = document.querySelector("#message");
const searchButton = document.querySelector("#searchButton");

function createDetail(label, value) {
    const section = document.createElement("section");
    section.className = "detail";

    const heading = document.createElement("h3");
    heading.textContent = label;

    const content = document.createElement("div");
    content.className = "detail-content";

    if (typeof value === "string" && value.trim()) {
        content.textContent = value || "Não informado pela AniList.";
    } else if (Array.isArray(value) && value.length > 0) {
        content.append(...value);
    } else {
        content.textContent = "Não informado pela AniList.";
    }

    section.append(heading, content);
    return section;
}

function cleanBiography(description) {
    const metadataFields = /^(?:height|altura|weight|peso|occupation|occupations|cargo|cargos|job|jobs|profession|profiss[aã]o|role|position|title|rank|ranking|age|idade|gender|g[eê]nero|birthday|birth(?:day|date)|anivers[aá]rio|data de nascimento|status|species|esp[eé]cie|race|ra[cç]a|nationality|nacionalidade|affiliation|affiliations|afil[ií]a[cç][aã]o|family|fam[ií]lia|hair|eyes|eye color|hair color|blood type|tipo sangu[ií]neo|measurements|medidas|debut|estreia|voice actor|dublador(?:es|a)?|abilities|ability|powers|poderes|skills|habilidades|likes|dislikes|gostos|desgostos|relationships|rela[cç][oõ]es|trivia|profile|perfil)\b/i;
    const lines = (description || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]*\)/gi, "$1")
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
        .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "")
        .replace(/<a\b[^>]*>(.*?)<\/a>/gis, "$1")
        .replace(/<[^>]*>/g, " ")
        .replace(/https?:\/\/\S+|www\.\S+/gi, "")
        .replace(/\b(?:character\s*)?id\s*[:#]?\s*\d+\b/gi, "")
        .replace(/(^|\s)#\d+\b/g, "$1")
        .split(/\r?\n/)
        .map((line) => line
            .replace(/^\s*(?:[-*+>]\s*)+/, "")
            .replace(/^\s*#{1,6}\s*/, "")
            .replace(/[*_~`]/g, "")
            .trim())
        .filter((line) => line && !metadataFields.test(line.replace(/^[\[(]+/, "")));

    const sentences = lines
        .join(" ")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence && !metadataFields.test(sentence));
    let summary = sentences.slice(0, 2).join(" ");

    if (summary.length > 280) {
        summary = `${summary.slice(0, 277).replace(/\s+\S*$/, "")}...`;
    }

    return summary;
}

function createCharacterCard(character) {
    const card = document.createElement("article");
    card.className = "card";

    if (character.imageUrl) {
        const image = document.createElement("img");
        image.src = character.imageUrl;
        image.alt = `Imagem de ${character.name}`;
        image.loading = "lazy";
        card.append(image);
    }

    const info = document.createElement("div");
    info.className = "info";

    const title = document.createElement("h2");
    title.textContent = character.name;

    const animeLinks = character.anime.map((anime) => {
        const link = document.createElement("a");
        link.href = anime.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = anime.title;
        return link;
    });

    const voiceActors = character.voiceActors.map((actor) => {
        const item = document.createElement("p");
        item.textContent = actor.language
            ? `${actor.name} (${actor.language})`
            : actor.name;
        return item;
    });

    const cleanDescription = cleanBiography(character.description);
    const biography = cleanDescription
        ? `${cleanDescription}\n\n(Texto original da AniList; pode não estar em português.)`
        : "Biografia não informada pela AniList.";

    info.append(
        title,
        createDetail("Nome em japonês", character.nativeName),
        createDetail("Anime", animeLinks),
        createDetail("Biografia", biography),
        createDetail("Dubladores japoneses (anime principal)", voiceActors),
        createDetail("Gênero", character.gender),
        createDetail("Idade", character.age)
    );

    card.append(info);
    return card;
}

async function queryAniList(query, variables) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({ query, variables }),
            signal: controller.signal
        });

        const json = await response.json();
        if (!response.ok || json.errors?.length) {
            const apiMessage = json.errors?.map((apiError) => apiError.message).join(" ");
            throw new Error(
                apiMessage
                    ? `AniList: ${apiMessage}`
                    : `AniList respondeu com erro (${response.status}).`
            );
        }

        return json.data;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("A AniList demorou para responder. Tente novamente.");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchAniListCharacters(name) {
    const query = `
        query ($search: String) {
            Page(page: 1, perPage: 6) {
                characters(search: $search, sort: FAVOURITES_DESC) {
                    id
                    name {
                        full
                        native
                    }
                    image {
                        large
                    }
                    description(asHtml: false)
                    gender
                    age
                    media(type: ANIME, perPage: 6, sort: POPULARITY_DESC) {
                        nodes {
                            id
                            title {
                                romaji
                                english
                                native
                            }
                            siteUrl
                        }
                    }
                }
            }
        }
    `;
    const data = await queryAniList(query, { search: name });
    const results = data?.Page?.characters;
    if (!Array.isArray(results)) {
        throw new Error("A AniList retornou uma resposta inválida para a busca.");
    }

    return Promise.all(results.map(async (character) => {
        const media = character.media?.nodes || [];
        let voiceActors = [];

        if (media[0]?.id) {
            const voiceActorQuery = `
                query ($mediaId: Int) {
                    Media(id: $mediaId) {
                        characters(perPage: 25) {
                            edges {
                                node {
                                    id
                                }
                                voiceActors(language: JAPANESE) {
                                    name {
                                        full
                                    }
                                    languageV2
                                }
                            }
                        }
                    }
                }
            `;
            const actorData = await queryAniList(voiceActorQuery, { mediaId: media[0].id });
            const matchingEdge = actorData?.Media?.characters?.edges?.find(
                (edge) => edge.node?.id === character.id
            );
            voiceActors = (matchingEdge?.voiceActors || [])
                .filter((actor) => actor?.name?.full)
                .map((actor) => ({
                    name: actor.name.full,
                    language: actor.languageV2
                }));
        }

        return {
            name: character.name?.full || "Nome não informado",
            nativeName: character.name?.native,
            description: character.description?.trim(),
            imageUrl: character.image?.large,
            gender: character.gender,
            age: character.age,
            anime: media
                .filter((item) => item?.siteUrl)
                .map((item) => ({
                    title: item.title?.english || item.title?.romaji || item.title?.native,
                    url: item.siteUrl
                }))
                .filter((item) => item.title),
            voiceActors
        };
    }));
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = input.value.trim();
    if (!name) {
        message.textContent = "Por favor, digite o nome de um personagem.";
        input.focus();
        return;
    }

    result.replaceChildren();
    message.textContent = "Pesquisando personagens na AniList...";
    searchButton.disabled = true;

    try {
        const characters = await fetchAniListCharacters(name);

        if (characters.length === 0) {
            message.textContent = "Nenhum personagem encontrado. Tente outro nome.";
            return;
        }

        result.replaceChildren(...characters.map(createCharacterCard));
        message.textContent = `${characters.length} personagem(ns) encontrado(s) na AniList.`;
    } catch (error) {
        message.textContent = error.message || "Não foi possível buscar na AniList.";
        console.error("Falha ao buscar personagens na AniList:", error);
    } finally {
        searchButton.disabled = false;
    }
});
