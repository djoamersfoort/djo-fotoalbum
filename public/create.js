const titlePreview = document.getElementById("titlePreview");
const descriptionPreview = document.getElementById("descriptionPreview");
const name = document.getElementById("name");
const description = document.getElementById("description");

name.addEventListener("input", () => {
    titlePreview.innerText = name.value;
});
description.addEventListener("input", () => {
    descriptionPreview.innerText = description.value;
});