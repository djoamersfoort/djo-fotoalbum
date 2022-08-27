const albums = document.getElementById("albums");
const add = document.getElementById("add");

const res = await fetch(`/getAlbums`);
const albumsJson = await res.json();

for (const i in albumsJson) {
    const album = albumsJson[i];
    const el = document.createElement("div");
    el.classList.add("album");

    let background;
    if (album.preview) {
        background = document.createElement("img");
        background.src = `/file/${i}/${album.preview}`;
        background.classList.add("background");
    } else {
        background = document.createElement("div");
        background.classList.add("background");
    }

    const meta = document.createElement("div");
    meta.classList.add("meta");

    const title = document.createElement("h2");
    title.innerText = album.name;
    meta.append(title);

    const description = document.createElement("p");
    description.innerText = album.description;
    meta.append(description);

    el.append(background, meta);

    el.addEventListener("click", () => {
        window.location.assign(`/album?album=${i}`);
    });

    albums.append(el);
}

const getColumns = () => {
    const totalColumns = Math.floor(window.innerWidth / 300);
    if (totalColumns < 1) return 1;
    if (totalColumns > 4) return 4;

    albums.style.gridTemplateColumns = `repeat(${totalColumns}, 1fr)`;
}
getColumns();

window.addEventListener("resize", getColumns);

const pRes = await fetch("/permissions");
const permissions = await pRes.json();

if (!permissions.includes("")) {
    add.style.display = "none";
}

add.addEventListener("click", () => {
    window.location.assign("/create.html");
});