import express from 'express'
import multer from 'multer'
import fs from 'fs'
import { exec } from 'child_process'
import sharp from 'sharp'
import { v4 as uuid } from 'uuid'
import bodyParser from 'body-parser'
import ffmpeg from 'fluent-ffmpeg'
import sizeOf from 'image-size'
import Login from '@djoamersfoort/djo-login-js'

let configFile, albums
if (fs.existsSync('./data/config.json')) {
    configFile = JSON.parse(fs.readFileSync('./data/config.json').toString())
} else {
    fs.writeFileSync('./data/config.json', JSON.stringify({
        oauth: {
            client: {
                id: 'CLIENT_ID',
                secret: 'CLIENT_SECRET'
            }
        },
        base_uri: 'http://localhost:3000',
        lastVersion: '2022.8.27.1'
    }))
    throw 'Generated example Config, please customize settings and re-run'
}
if (fs.existsSync('./data/albums.json')) {
    albums = JSON.parse(fs.readFileSync('./data/albums.json').toString())
} else {
    albums = []
}

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const djo = new Login(configFile.oauth.client.id, configFile.oauth.client.secret, `${configFile.base_uri}/callback`, 'user/basic')
app.use(djo.session)

const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "data/files");
    },
    filename: (req, file, cb) => {
        cb(null, `${uuid()}`);
    },
});
const upload = multer({
    storage: multerStorage,
    fileFilter: function(req, file, cb) {
        if(typeof req.session.user === "undefined") return cb(null, false);
        if(typeof albums[req.params.album] === "undefined") return cb(null, false);
        if(!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) return cb(null, false);

        cb(null, true);
    }
});

app.use(express.static("public"));

app.get("/", djo.requireLogin, (req, res) => {
    res.sendFile(`${process.cwd()}/public/page.html`);
})
app.get("/album", (req, res) => {
    if (typeof albums[parseInt(req.query.album)] === "undefined") return res.send("not an album!");
    if (typeof req.session.user === "undefined" && !albums[parseInt(req.query.album)].public) {
        return res.redirect(djo.authorize_uri(req.url));
    }

    res.sendFile(`${process.cwd()}/public/album.html`);
})
app.get("/camera", djo.requireLogin, (req, res) => {
    res.sendFile(`${process.cwd()}/public/camera.html`);
})
app.get("/callback", djo.callback)
app.get("/logout", (req, res) => {
    delete req.session.user;

    res.redirect("/");
})

const getMetaData = async (file) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(file, (err, metadata) => {
            if (err) return reject(err)
            resolve(metadata)
        })
    })
}
app.post("/upload/:album", djo.requireLogin, upload.array("photo"), async (req, res) => {
    if (!req.files) return res.json({error: 1, msg: "No files were uploaded!"});
    for (const i in req.files) {
        const file = req.files[i];

        if (!file) continue;
        file.path = file.path.replaceAll('\\', '/')
        if (file.mimetype.startsWith("video/")) {
            exec(`ffmpeg -i "${file.path}" -c:v libx264 -preset veryfast -crf 22 -c:a aac -b:a 128k -strict -2 "${file.path}.mp4"`, async (err, stdout, stderr) => {
                if (err) return console.log(err);

                fs.unlink(file.path, async () => {
                    fs.rename(`${file.path}.mp4`, file.path, async () => {
                        const res = await getMetaData(file.path);
                        albums[req.params.album].files.push({
                            id: file.path.split("/")[2],
                            date: new Date().getTime(),
                            user: req.session.user,
                            meta: {
                                width: res.streams[0].width,
                                height: res.streams[0].height,
                                duration: res.streams[0].duration,
                            },
                            type: "video"
                        })
                        fs.writeFileSync("data/albums.json", JSON.stringify(albums));
                    });
                });
            });
        } else if (file.mimetype.startsWith("image/") && !file.mimetype.endsWith("svg+xml")) {
            sharp(file.path)
                .rotate()
                .webp({quality: 80})
                .toFile(`${file.path}.webp`)
                .then(info => {
                    fs.unlink(file.path, () => {
                        fs.rename(`${file.path}.webp`, file.path, () => {
                            albums[req.params.album].files.push({
                                id: file.path.split("/")[2],
                                date: new Date().getTime(),
                                user: req.session.user,
                                meta: sizeOf(file.path),
                                type: "image"
                            })
                            fs.writeFileSync("data/albums.json", JSON.stringify(albums))
                        });
                    });
                })
                .catch(err => {
                    console.log(err);
                });
        }
    }

    res.json({error: 0});
})

app.get("/files/:album", (req, res) => {
    if (typeof albums[req.params.album] === "undefined") return res.send("Album not found!");
    if (typeof req.session.user === "undefined" && !albums[parseInt(req.params.album)].public) return res.json([]);

    const files = albums[req.params.album].files.sort((a, b) => {
        if (a.date > b.date) return -1;
        return 1;
    })
    res.json(files);
});
app.get("/file/:album/:id", (req, res) => {
    if (typeof albums[req.params.album] === "undefined") return res.send("Album not found!");
    if (typeof req.session.user === "undefined" && !albums[parseInt(req.params.album)].public) return res.send("Not signed in!");
    const filter = albums[req.params.album].files.filter(file => file.id === req.params.id);
    if (filter.length === 0) return res.send("File not in album!");

    res.sendFile(`${process.cwd()}/data/files/${req.params.id}`);
});
app.get("/getAlbums", (req, res) => {
    res.json(albums.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
})

app.post("/createAlbum", djo.requireLogin, (req, res) => {
    if (typeof req.body.name === "undefined") return res.send("No name given!");
    if (typeof req.body.public === "undefined") return res.send("No public given!");
    if (typeof req.body.description === "undefined") return res.send("No description given!");
    if (!req.session.djo.accountType.split(",").includes("begeleider")) return res.send("Not authorized!");

    albums.push({
        name: req.body.name,
        public: req.body.public === "true",
        description: req.body.description,
        preview: req.body.preview,
        files: []
    });
    fs.writeFileSync("data/albums.json", JSON.stringify(albums));

    res.redirect("/");
})
app.post('/update/:album', djo.requireLogin, (req, res) => {
    if (!req.body.name || !req.body.public || typeof req.body.description === 'undefined')
        return res.send("invalid form!");
    if (!req.session.djo.accountType.split(",").includes("begeleider"))
        return res.send("Not authorized!");

    albums[req.params.album] = {
        ...albums[req.params.album],
        name: req.body.name,
        public: req.body.public === 'true',
        description: req.body.description
    }
    fs.writeFileSync("data/albums.json", JSON.stringify(albums));

    res.redirect('/')
})
app.get("/delete/:album/:id", djo.requireLogin, (req, res) => {
    if (typeof albums[req.params.album] === "undefined") return res.send("Album not found!");
    const filter = albums[req.params.album].files.filter(file => file.id === req.params.id);
    if (filter.length === 0) return res.send("File not in album!");
    if (filter[0].user !== req.session.user && !req.session.djo.accountType.split(",").includes("begeleider")) return res.send("Incorrect permissions!");

    albums[req.params.album].files.splice(albums[req.params.album].files.indexOf(filter[0]), 1);
    fs.unlink(`./data/files/${req.params.id}`, () => {
        res.redirect(`/album?album=${req.params.album}`);
    });
    fs.writeFileSync("data/albums.json", JSON.stringify(albums));
})
app.post("/bulkDelete", djo.requireLogin, (req, res) => {
    if (typeof req.body.files === "undefined") return res.send("No files given!");
    if (!Array.isArray(req.body.files)) return res.send("Files must be an array!");

    for (const i in req.body.files) {
        const file = req.body.files[i];

        if (typeof albums[req.body.album] === "undefined") continue;
        const filter = albums[req.body.album].files.filter(a => a.id === file);
        if (filter.length === 0) continue;
        if (filter[0].user !== req.session.user && !req.session.djo.accountType.split(",").includes("begeleider")) continue;

        albums[req.body.album].files.splice(albums[req.body.album].files.indexOf(filter[0]), 1);
        fs.unlink(`./data/files/${file}`, () => {});
    }

    fs.writeFileSync("data/albums.json", JSON.stringify(albums));
    res.json({error: 0});
})

app.get("/setPreview/:album/:file", djo.requireLogin, (req, res) => {
    if (typeof albums[req.params.album] === "undefined") return res.send("Album not found!");
    if (!fs.existsSync(`data/files/${req.params.file}`)) return res.send("File not found!");
    if (!req.session.djo.accountType.split(",").includes("begeleider")) return res.send("You can't set this file as preview!");

    albums[req.params.album].preview = req.params.file;
    fs.writeFileSync(`${process.cwd()}/data/albums.json`, JSON.stringify(albums));

    res.redirect(`/album?album=${req.params.album}`);
});
app.get("/permissions", djo.requireLogin, (req, res) => {
    return res.json([
        req.session.djo.accountType.split(",").includes("begeleider") ? "" : req.session.user,
    ])
})

app.listen(3000, () => {console.log(`App listening on port 3000`)});
