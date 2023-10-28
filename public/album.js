const columns = document.querySelectorAll('.column');
const modal = document.getElementById('modal');
let preview = document.getElementById('preview');
const backBtn = document.getElementById('back');
const nextBtn = document.getElementById('next');
const closeBtn = document.getElementById('close');
const date = document.getElementById('date');
const icons = document.getElementById('icons');
const star = document.getElementById('star');
const camera = document.getElementById('camera');
const file = document.querySelector("#file");
const deleteBtn = document.getElementById('delete');
const bulkDelete = document.getElementById("bulkDelete");
const actions = document.getElementById("actions");
const title = document.querySelector(".title");
const edit = document.getElementById('edit')
const uploading = document.getElementById('uploading')
const progress = document.getElementById('progress')

const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
]

const urlParams = new URLSearchParams(window.location.search);
const album = urlParams.get("album");

const filesResponse = await fetch(`/files/${album}`);
const files = await filesResponse.json();

const albumNameResponse = await fetch(`/getAlbums`);
const albums = await albumNameResponse.json();
const albumName = albums[urlParams.get("album")].name;
title.innerHTML = albumName;
document.title = `${albumName} | DJO Media`;

const images = [];

const getColumns = () => {
    const totalColumns = Math.floor(window.innerWidth / 300);
    if (totalColumns < 1) return 1;
    if (totalColumns > 4) return 4;

    return totalColumns;
}

let lastWidth = null;
const order = () => {
    const totalColumns = getColumns();
    if (lastWidth === totalColumns) return;

    lastWidth = totalColumns;
    for (let i = 0; i < totalColumns; i++) {
        columns[i].style.display = "block";
    }
    for (let i = 3; i >= totalColumns; i--) {
        columns[i].style.display = "none";
    }

    for (const i in images) {
        if (images[i].parentElement) {
            images[i].parentElement.removeChild(images[i]);
        }

        columns[i % totalColumns].append(images[i]);
    }
}

let permissions = [];

let checked = [];
bulkDelete.addEventListener("click", async () => {
    if (bulkDelete.classList.contains("disabled")) return;
    const res = await fetch("/bulkDelete", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({files: checked.map(file => file.id), album})
    });
    const body = await res.text();

    window.location.reload();
});

const checkBox = (container, file) => {
    const check = document.createElement("div");
    check.classList.add("check");
    const i = document.createElement("i");
    i.classList.add("fa-solid", "fa-check");
    check.append(i);
    let isChecked = false;

    const toggle = () => {
        if (isChecked) {
            isChecked = false;
            check.classList.remove("checked");
            checked.splice(checked.indexOf(file), 1);
            container.classList.remove("selected");

            if (bulkDelete.classList.contains("disabled")) {
                let amount = 0;

                for (const i in checked) {
                    if (!permissions.includes(checked[i].user) && !permissions.includes("")) {
                        amount++;
                    }
                }

                if (amount === 0) {
                    bulkDelete.classList.remove("disabled");
                }
            }
        } else {
            isChecked = true;
            check.classList.add("checked");
            checked.push(file);
            container.classList.add("selected");

            if (!permissions.includes(file.user) && !permissions.includes("")) {
                bulkDelete.classList.add("disabled");
            }
        }

        if (checked.length > 0) {
            actions.style.transform = "translateY(0)";
        } else {
            actions.style.transform = "translateY(100%)";
        }
    }
    check.addEventListener("click", () => {
        toggle()
    });
    container.addEventListener("click", (e) => {
        if (checked.length > 0 && e.target !== check) {
            toggle();
        }
    });

    return check;
}

const createImg = (file) => {
    const container = document.createElement("div");
    container.classList.add("container");

    const img = document.createElement("img");

    img.classList.add("img");
    img.loading = "lazy";
    img.src = `/file/${album}/${file.id}`;
    img.style.aspectRatio = `${file.meta.width} / ${file.meta.height}`;

    img.addEventListener("click", () => {
        if (checked.length > 0) return;
        openModal();
        switchSrc(file);

        setMeta();
    });

    container.append(img, checkBox(container, file));
    images.push(container);
}
const switchSrc = (file) => {
    open = files.indexOf(file);
    if (file.type === "video") {
        const newPreview = document.createElement("video");

        newPreview.src = `/file/${album}/${file.id}`;
        newPreview.controls = true;
        newPreview.autoplay = true;
        preview.parentNode.replaceChild(newPreview, preview);
        preview = newPreview;
        return;
    }

    const newPreview = document.createElement("img");

    newPreview.src = `/file/${album}/${file.id}`;
    preview.parentNode.replaceChild(newPreview, preview);
    preview = newPreview;
}
const createVideo = (file) => {
    const container = document.createElement("div");
    container.classList.add("container");

    const video = document.createElement("video");
    video.preload = "metadata";
    video.controls = false;
    video.src = `/file/${album}/${file.id}`;
    video.classList.add("img");
    container.append(video);

    const play = document.createElement("img");
    play.src = "/play-solid.svg";
    play.classList.add("play");

    container.addEventListener("click", () => {
        if (checked.length > 0) return;
        openModal();
        switchSrc(file);

        setMeta();
    });

    container.append(play, checkBox(container, file));
    images.push(container);
}

let open;
for (const file of files) {
    if (file.type === "video") createVideo(file)
    else createImg(file);
}
order();

const setMeta = () => {
    const imgDate = new Date(files[open].date);
    date.innerText = `${imgDate.getDate()} ${months[imgDate.getMonth()]}, ${imgDate.getFullYear()}`;

    if (permissions.includes(files[open].user) || permissions.includes("")) {
        deleteBtn.style.display = "block";
    } else {
        deleteBtn.style.display = "none";
    }
}
const openModal = () => {
    modal.style.display = "flex";
    for (const column of columns) {
        column.style.filter = "blur(5px)";
    }
}
const next = () => {
    open++;
    if (open > files.length - 1) open = 0;
    switchSrc(files[open]);

    setMeta();
}
const back = () => {
    open--;
    if (open < 0) open = files.length - 1;
    switchSrc(files[open]);

    setMeta();
}
const close = () => {
    modal.style.display = "none";
    for (const column of columns) {
        column.style.filter = "blur(0px)";
    }
}

nextBtn.addEventListener("click", next);
backBtn.addEventListener("click", back);
closeBtn.addEventListener("click", close);

document.body.addEventListener("keydown", (e) => {
    switch(e.key) {
        case "ArrowLeft":
            back();
            break;
        case "ArrowRight":
            next();
            break;
        case "Escape":
            close();
            break;
    }
})

camera.addEventListener("click", () => {
    window.location.assign(`/camera?album=${album}`);
});
file.addEventListener("change", async e => {
    const formData = new FormData();
    for (let i in file.files) {
        formData.append("photo", file.files[i]);
    }
    const xhr = new XMLHttpRequest()
    uploading.style.display = 'flex'
    const success = await new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
                progress.style.setProperty('--progress', `${event.loaded / event.total}`)
                console.log("upload progress:", event.loaded / event.total);
            }
        });
        xhr.addEventListener("loadend", () => {
            resolve(xhr.readyState === 4 && xhr.status === 200);
        });

        xhr.open('POST', `/upload/${album}`, true)
        xhr.send(formData)
    })
    window.location.reload()
})

deleteBtn.addEventListener("click", () => {
    window.location.replace(`/delete/${album}/${files[open].id}`);
});
star.addEventListener("click", () => {
    window.location.replace(`/setPreview/${album}/${files[open].id}`);
});

window.addEventListener("resize", order);

const pRes = await fetch("/permissions");
permissions = await pRes.json();
if (permissions.includes("")) {
    star.style.display = "block";
    edit.style.display = 'block'
    edit.href = `/create.html?album=${album}`
} else {
    star.style.display = "none";
}
