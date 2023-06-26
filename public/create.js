const form = document.getElementById('form')
const titlePreview = document.getElementById("titlePreview");
const descriptionPreview = document.getElementById("descriptionPreview");
const name = document.getElementById("name");
const description = document.getElementById("description");
const tile = document.getElementById('tile')
const action = document.getElementById('action')
const publicE = document.getElementById('public')

const urlParams = new URLSearchParams(window.location.search);

name.addEventListener("input", () => {
    titlePreview.innerText = name.value;
});
description.addEventListener("input", () => {
    descriptionPreview.innerText = description.value;
});

const albumId = urlParams.get('album')
form.action = albumId ? `/update/${albumId}` : '/createAlbum'
action.value = albumId ? 'Update' : 'Create'

if (albumId) {
    fetch('/getAlbums')
        .then(async res => {
            const albums = await res.json()
            const album = albums[parseInt(albumId)]

            name.value = album.name
            titlePreview.innerText = album.name
            description.value = album.description
            descriptionPreview.innerText = album.description
            publicE.value = album.public ? 'true' : 'false'
            if (album.preview) {
                const img = document.createElement('img')
                img.classList.add('background')
                img.src = `/file/${albumId}/${album.preview}`
                tile.append(img)
            }
        })
}
