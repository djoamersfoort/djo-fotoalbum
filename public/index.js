const cam = document.querySelector("#cam");
const images = document.querySelector(".pictures");
const urlParams = new URLSearchParams(window.location.search);

cam.addEventListener("click", () => {
    window.location.assign(`/camera?album=${urlParams.get("album")}`);
});

const pages = [];
let photos = [];
let pageEls = [];
let open = false;

async function get() {
    const res = await fetch(`/files/${urlParams.get("album")}`);
    const body = await res.json();
    const switcher = document.querySelector("#switcher");
    photos = body;

    for (let page = 0; page < body.length / 9; page++) {
        pages[page] = [];
        for (let i = 0; i < 9; i++) {
            if (typeof body[page * 9 + i] === "undefined") continue;
            pages[page][i] = body[page * 9 + i];
        }

        const el = document.createElement("div");
        el.classList.add("page");
        el.innerText = page + 1;
        pageEls.push(el);

        el.addEventListener("click", () => {
            openPage(pages[parseInt(el.innerText) - 1]);

            switcher.querySelectorAll(".page").forEach((el) => {
                el.classList.remove("selected");
            })
            el.classList.add("selected");
        })
        switcher.append(el);

        if (page ===  0) el.classList.add("selected");
    }

    openPage(pages[0]);
}

const popup = document.querySelector(".popup");
let item = null;
function openPage(page) {
    images.innerHTML = "";

    for (let i in page) {
        if (page[i].endsWith(".webm") || page[i].endsWith(".mp4")) {
            const holder = document.createElement("div");
            holder.classList.add("holder");
            const vid = document.createElement("video");
            vid.preload = "metadata";
            vid.src = `/file/${page[i]}`;
            holder.addEventListener("click", e => {
                popup.style.display = "block";
                setSrc(vid.src);
                item = photos.indexOf(page[i]);
                open = true;
            })

            vid.classList.add("img");
            holder.append(vid);

            const play = document.createElement("img");
            play.classList.add("play");
            play.src = "/play-solid.svg";
            holder.append(play);

            images.append(holder);
        } else {
            const img = document.createElement("img");
            img.src = `/file/${page[i]}`;
            img.addEventListener("click", () => {
                popup.style.display = "block";
                setSrc(img.src);
                item = photos.indexOf(page[i]);
                open = true;
            })

            img.classList.add("img");
            images.append(img);
        }
    }
}

get();

const left = document.querySelector(".left");
const right = document.querySelector(".right");
const close = document.querySelector(".close");

left.addEventListener("click", () => {
    item -= 1;
    if (item === -1) {
        item = photos.length - 1;
    }
    pageSwitch();
    setSrc("/file/" + photos[item]);
})
right.addEventListener("click", () => {
    item += 1;
    if (item === photos.length) {
        item = 0;
    }
    pageSwitch();
    setSrc("/file/" + photos[item]);
})
close.addEventListener("click", () => {
    popup.style.display = "none";
    open = false;
})

document.body.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft") {
        left.click();
    } else if (e.key === "ArrowRight") {
        right.click();
    } else if (e.key === "Escape") {
        close.click();
    }
})

const types = ["IMG", "VIDEO"];
document.body.addEventListener("click", e => {
    if (popup.contains(e.target) || types.includes(e.target.tagName)) return;
    if (!open) return;
    close.click();
})

function pageSwitch() {
    const page = Math.floor((item + 1) / 9);
    switcher.querySelectorAll(".page").forEach((el) => {
        el.classList.remove("selected");
    })
    pageEls[page].classList.add("selected");

    openPage(pages[page]);
}
const popupContent = document.querySelector("#popupContent");
let currImage = null;
function setSrc(src) {
    if (currImage !== null) popupContent.removeChild(currImage);

    if (src.endsWith(".mp4") || src.endsWith(".webm")) {
        const vid = document.createElement("video");
        vid.src = src;
        vid.classList.add("img");
        vid.controls = true;
        vid.autoplay = true;
        popupContent.prepend(vid);
        currImage = vid;
    } else {
        const img = document.createElement("img");
        img.src = src;
        img.classList.add("img");
        popupContent.prepend(img);
        currImage = img;
    }
}