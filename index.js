const express = require("express");
const session = require("express-session");
let configFile = require("./data/config.json");
const { AuthorizationCode } = require("simple-oauth2");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
let albums = require("./data/albums.json");
const { exec } = require("child_process");
const sharp = require("sharp");
const { v4: uuid } = require("uuid");
const bodyParser = require("body-parser");
const ffmpeg = require("fluent-ffmpeg");
const sizeOf = require("image-size");

if (!configFile.lastVersion) {
    console.log("Starting migration to version 2022.8.27.1")
    require("./migrate");
    configfile = require("./data/config.json");
    albums = require("./data/albums.json");
}

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: configFile.session_key,
    saveUninitialized:true,
    cookie: { maxAge: 7 * 24 * 3600 * 1000 }, // 7 Days (in milliseconds)
    resave: false
}))
const client = new AuthorizationCode(configFile.oauth);
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

app.get("/", (req, res) => {
    if (typeof req.session.user === "undefined") {
        const authorizationUri = client.authorizeURL({
            redirect_uri: `${configFile.base_uri}/callback`,
            scope: "user/basic",
            state: req.query.state
        });

        return res.redirect(authorizationUri);
    }

    res.sendFile(`${__dirname}/public/page.html`);
});
app.get("/album", (req, res) => {
    if (typeof albums[parseInt(req.query.album)] === "undefined") return res.send("not an album!");
    if (typeof req.session.user === "undefined" && !albums[parseInt(req.query.album)].public) {
        const authorizationUri = client.authorizeURL({
            redirect_uri: `${configFile.base_uri}/callback`,
            scope: "user/basic",
            state: req.query.state
        });

        return res.redirect(authorizationUri);
    }

    res.sendFile(`${__dirname}/public/album.html`);
})
app.get("/camera", (req, res) => {
    if (typeof req.session.user === "undefined") {
        const authorizationUri = client.authorizeURL({
            redirect_uri: `${configFile.base_uri}/callback`,
            scope: "user/basic",
            state: req.query.state
        });

        return res.redirect(authorizationUri);
    }

    res.sendFile(`${__dirname}/public/camera.html`);
})
app.get("/callback", async (req, res) => {
    if (typeof req.query.code === "undefined") return res.send("No");

    const tokenParams = {
        code: req.query.code,
        redirect_uri: `${configFile.base_uri}/callback`,
        scope: "user/basic",
    };

    try {
        const tokenDetails = await client.getToken(tokenParams);
        const accessToken = tokenDetails.token.access_token;

        axios.get("https://leden.djoamersfoort.nl/api/v1/member/details", {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }) .then(_res => {
            req.session.type = _res.data.accountType;
            req.session.user = _res.data.id;

            return res.redirect("/");
        })
            .catch(err => {
                return res.send("An error occurred while trying to fetch user data!");
            })
    } catch (e) {
        return res.send("An error occurred while handling login process!");
    }
})
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
app.post("/upload/:album", upload.array("photo"), async (req, res) => {
    if (typeof req.session.user === "undefined") return res.json({error: 1, msg: "Invalid user!"});
    if (!req.files) return res.json({error: 1, msg: "No files were uploaded!"});
    for (const i in req.files) {
        const file = req.files[i];

        if (!file) continue;
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

    res.sendFile(`${__dirname}/data/files/${req.params.id}`);
});
app.get("/getAlbums", (req, res) => {
    res.json(albums.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
})

app.post("/createAlbum", (req, res) => {
    if (typeof req.session.user === "undefined") return res.send("Not signed in!");
    if (typeof req.body.name === "undefined") return res.send("No name given!");
    if (typeof req.body.public === "undefined") return res.send("No public given!");
    if (typeof req.body.description === "undefined") return res.send("No description given!");
    if (!req.session.type.split(",").includes("begeleider")) return res.send("Not authorized!");

    const dir = `data/${req.body.name}`;
    if (fs.existsSync(dir)) return res.send("Album already exists!");

    fs.mkdirSync(__dirname + "/" + dir);

    albums.push({
        name: req.body.name,
        dir: dir,
        public: req.body.public === "true",
        description: req.body.description,
        preview: req.body.preview
    });
    fs.writeFileSync("data/albums.json", JSON.stringify(albums));

    fs.writeFileSync(`${__dirname}/data/albums.json`, JSON.stringify(albums));

    res.redirect("/");
})
app.get("/delete/:album/:id", (req, res) => {
    if (typeof req.session.user === "undefined") return res.send("Not signed in!");
    if (typeof albums[req.params.album] === "undefined") return res.send("Album not found!");
    const filter = albums[req.params.album].files.filter(file => file.id === req.params.id);
    if (filter.length === 0) return res.send("File not in album!");
    if (filter[0].user !== req.session.user && !req.session.type.split(",").includes("begeleider")) return res.send("Incorrect permissions!");

    albums[req.params.album].files.splice(albums[req.params.album].files.indexOf(filter[0]), 1);
    fs.unlink(`./data/files/${req.params.id}`, () => {
        res.redirect(`/album?album=${req.params.album}`);
    });
    fs.writeFileSync("data/albums.json", JSON.stringify(albums));
})
app.post("/bulkDelete", (req, res) => {
    if (typeof req.session.user === "undefined") return res.send("Not signed in!");
    if (typeof req.body.files === "undefined") return res.send("No files given!");
    if (!Array.isArray(req.body.files)) return res.send("Files must be an array!");

    for (const i in req.body.files) {
        const file = req.body.files[i];

        if (typeof albums[req.body.album] === "undefined") continue;
        const filter = albums[req.body.album].files.filter(a => a.id === file);
        if (filter.length === 0) continue;
        if (filter[0].user !== req.session.user && !req.session.type.split(",").includes("begeleider")) continue;

        albums[req.body.album].files.splice(albums[req.body.album].files.indexOf(filter[0]), 1);
        fs.unlink(`./data/files/${file}`, () => {});
    }

    fs.writeFileSync("data/albums.json", JSON.stringify(albums));
    res.json({error: 0});
})

app.get("/setPreview/:album/:file", (req, res) => {
    if (typeof req.session.user === "undefined") return res.send("Not signed in!");
    if (typeof albums[req.params.album] === "undefined") return res.send("Album not found!");
    if (!fs.existsSync(`data/files/${req.params.file}`)) return res.send("File not found!");
    if (!req.session.type.split(",").includes("begeleider")) return res.send("You can't set this file as preview!");

    albums[req.params.album].preview = req.params.file;
    fs.writeFileSync(`${__dirname}/data/albums.json`, JSON.stringify(albums));

    res.redirect(`/album?album=${req.params.album}`);
});
app.get("/permissions", (req, res) => {
    if (typeof req.session.user === "undefined") return res.send("Not signed in!");

    return res.json([
        req.session.type.split(",").includes("begeleider") ? "" : req.session.user,
    ])
})

app.listen(3000, () => {console.log(`App listening on port 3000`)});
