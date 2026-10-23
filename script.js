const form = document.querySelector("#searchForm");
const input = document.querySelector("#searchInput");
const result = document.querySelector(".resultados");
const message = document.querySelector("#message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = input.value.trim();

    if (!name)
{
        message.textContent = "Por favor, digite o nome de um personagem.";
        return;
}

    message.textContent = "Pesquisando personagem...";

    try {
        const response = await fetch(
`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&limit=1`);

if (!response.ok) {
            throw new Error("Não foi possível acessar a API.");
        }

        const json = await response.json();

        const character = json.data[0];

        if (!character) {
            message.textContent = "Nenhum personagem encontrado.";
            return;
        }

        const card = document.createElement("div");
        card.className = "card";

        const image = document.createElement("img");
        image.src = character.images.jpg.image_url;
        image.alt = `Imagem de ${character.name}`;
        
        const info = document.createElement("div");
        info.className = "info";

        const title = document.createElement("h2");
        title.textContent = character.name;

        const japaneseName = document.createElement("p");
        japaneseName.textContent = `Nome em japonês: ${character.name_kanji || "não informado"}`;

        const descricao = document.createElement("p");
        descricao.textContent = character.about || "Biografia não disponível.";

        info.append(title, japaneseName, descricao);
        card.append(image, info);
        result.append(card);

        message.textContent = "";

    } catch (error) {
        message.textContent = "Ocorreu um erro ao buscar o personagem.";

        console.error(error);
    }
});