const albums = require("./data/albums.json");
const configFile = require("./data/config.json");
const { v4: uuid } = require("uuid");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const sizeOf = require('image-size')
const mime = require("mime-types");

const getMetaData = async (file) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(file, (err, metadata) => {
            if (err) return reject(err)
            resolve(metadata)
        })
    })
}
fs.mkdirSync("data/files", { recursive: true });

const getAlbums = async () => {
    const newAlbums = [];
    for (const album of albums) {
        const newAlbum = {
            name: album.name,
            description: album.description,
            public: album.public,
            files: []
        }
        let percent = 0;

        const files = fs.readdirSync(album.dir)
        for (const file of files) {
            const dateString = file.split("-")[0];
            const userId = file.split("-user")[1].split(".")[0];
            const type = mime.lookup(file).split("/")[0];
            const fileId = uuid();
            let meta = null;
            if (type === "image") {
                meta = sizeOf(`${album.dir}/${file}`);
            } else if (type === "video") {
                const res = await getMetaData(`${album.dir}/${file}`);
                meta = {
                    width: res.streams[0].width,
                    height: res.streams[0].height,
                    duration: res.streams[0].duration,
                };
            }
            fs.renameSync(`./${album.dir}/${file}`, `data/files/${fileId}`);
            const image = {
                id: fileId,
                date: parseInt(dateString),
                user: userId,
                meta,
                type
            }
            newAlbum.files.push(image);
            percent += 100 / files.length;

            if (album.preview.split("/")[2] === file) newAlbum.preview = fileId;
            console.log(`Migrating album ${album.name}: ${Math.round(percent)}%`);
        }
        newAlbums.push(newAlbum);
        fs.rmdirSync(`./${album.dir}`)
    }

    fs.writeFileSync("./data/albums.json", JSON.stringify(newAlbums));

    configFile.lastVersion = "2022.8.27.1";
    fs.writeFileSync("./data/config.json", JSON.stringify(configFile));
}
getAlbums()