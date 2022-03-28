const express = require("express");
const session = require("express-session");
const configFile = require("./data/config.json");
const { AuthorizationCode } = require("simple-oauth2");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
const albums = require("./data/albums.json");
const mime = require("mime-types");

const app = express();
app.use(session({
    secret: configFile.session_key,
    saveUninitialized:true,
    cookie: { maxAge: 24 * 60 * 60 * 10000 },
    resave: false
}))
const client = new AuthorizationCode(configFile.oauth);
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, albums[req.params.album].dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-user${req.session.user}.${mime.extension(file.mimetype)}`);
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

app.post("/upload/:album", upload.single("photo"), (req, res) => {
    if (typeof req.session.user === "undefined") return res.json({error: 1, msg: "Invalid user!"});


    return res.json({error: 0});
})

app.get("/files/:album", (req, res) => {
    if (typeof albums[req.params.album] === "undefined") return res.send("Album not found!");
    if (typeof req.session.user === "undefined" && !albums[parseInt(req.params.album)].public) return res.json([]);

    const dir = albums[req.params.album].dir;
    fs.readdir(dir, function(err, files){
        files = files.map(function (fileName) {
            return {
                name: `${req.params.album}/${fileName}`,
                time: fs.statSync(dir + '/' + fileName).mtime.getTime()
            };
        })
            .sort(function (a, b) {
                if (parseInt(a.name.match(/\d+/gm)[1]) > parseInt(b.name.match(/\d+/gm)[1])) {
                    return -1;
                } else {
                    return 1;
                }
            })
            .map(function (v) {
                return v.name; });

        res.json(files);
    });
});
app.get("/file/:album/:id", (req, res) => {
    if (typeof albums[req.params.album] === "undefined") return res.send("Album not found!");
    if (typeof req.session.user === "undefined" && !albums[parseInt(req.params.album)].public) return res.send("Not signed in!");


    res.sendFile(`${__dirname}/${albums[req.params.album].dir}/${req.params.id}`);
});
app.get("/getAlbums", (req, res) => {
    res.json(albums);
})

app.listen(3000, () => {console.log(`App listening on port 3000`)});