const albums = document.querySelector(".albums");

async function get() {
    const res = await fetch(`/getAlbums`);
    const body = await res.json();
    const pRes = await fetch("/permissions");
    const permissions = await pRes.json();

    if (permissions.includes("")) {
        const add = document.querySelector(".add");
        add.addEventListener("click", () => {
            window.location.href = "/create.html";
        });
        add.style.display = "flex";
    }
    for (let i in body) {
        const album = body[i];

        const el = document.createElement("div");
        el.classList.add("album");

        const img = document.createElement("img");
        img.src = album.preview;

        const info = document.createElement("div");
        info.classList.add("info");

        const title = document.createElement("p");
        title.innerText = album.name;
        title.classList.add("title");
        const description = document.createElement("p");
        description.innerText = album.description;
        description.classList.add("description");
        info.append(title, description);

        el.append(img, info);
        albums.append(el);
        el.addEventListener("click", () => {
            window.location.assign(`/album?album=${i}`);
        })
    }
}

get();