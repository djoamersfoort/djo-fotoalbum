const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const virtVid = document.createElement("video");
virtVid.muted = true;
document.body.append(virtVid);
virtVid.setAttribute("playsinline", "");
virtVid.setAttribute("webkit-playsinline", "");

const video = document.querySelector("#camera");
video.muted = true;
const button = document.querySelector("#button");
const buttonafter = document.querySelector("#buttonafter");
const photobtn = document.querySelector("#photo");
const videobtn = document.querySelector("#video");
const switchBtn = document.getElementById("switch");
let mainstream;
const urlParams = new URLSearchParams(window.location.search);

let videos;
(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videos = devices.filter(device => {
        return device.kind === "videoinput";
    });

    if (videos.length < 2) {
        switchBtn.style.filter = "invert(1) opacity(.5)";
        switchBtn.style.cursor = "not-allowed";
    }

    let current = 0;
    switchBtn.addEventListener("click", () => {
        current++;
        if (current === videos.length) {
            current = 0;
        }

        capture(videos[current].deviceId);
    })
    capture(videos[0].deviceId);
})();

function capture(deviceId) {
    window.navigator.mediaDevices.getUserMedia({video: {deviceId}, audio: true})
        .then(async stream => {
            mainstream = stream;
            virtVid.srcObject = stream;
            video.srcObject = stream;
            video.onloadedmetadata = (e) => {
                video.play();
            };
            virtVid.onloadedmetadata = (e) => {
                virtVid.play();
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            videos = devices.filter(device => {
                return device.kind === "videoinput";
            });

            if (videos.length > 1) {
                switchBtn.style.filter = "invert(1)";
                switchBtn.style.cursor = "pointer";
            }
        })
        .catch(() => {
            alert('You have give browser the permission to run Webcam and mic ;( ');
        });
}

let blobsRecorded = [];
let mediaRecorder;
let recording = 0;
function startRecord() {
    recording = 1;
    const ba = buttonafter;
    mediaRecorder = new MediaRecorder(mainstream, { });

    mediaRecorder.addEventListener("dataavailable", function(e) {
        blobsRecorded.push(e.data);
    });

    mediaRecorder.addEventListener('stop', async function() {
        ba.style.borderRadius = "100%";
        ba.style.width = "100%";
        ba.style.height = "100%";

        const fd = new FormData(document.forms[0]);
        fd.append("photo", new Blob(blobsRecorded, {type: "video/webm"}));

        let res = await fetch(`/upload/${urlParams.get("album")}`, {
            method: "POST",
            body: fd,
        });
        const body = await res.json();

        if (body.error) return alert(body.msg);
        window.location.replace(`/album?album=${urlParams.get("album")}`);
    });

    mediaRecorder.start(1000);

    ba.style.borderRadius = "5px";
    ba.style.width = "50%";
    ba.style.height = "50%";
}

let mode = 0;
function toVideo() {
    if (mode === 1) return;
    mode = 1;
    const ba = buttonafter;
    ba.style.width = "100%";
    ba.style.height = "100%";
}
function toPhoto() {
    if (mode === 0) return;
    if (recording) return;
    mode = 0;
    const ba = buttonafter;
    ba.style.width = "0";
    ba.style.height = "0";
}

videobtn.addEventListener("click", () => {
    toVideo();
    videobtn.classList.add("selected");
    photobtn.classList.remove("selected");
});
photobtn.addEventListener("click", () => {
    toPhoto();
    photobtn.classList.add("selected");
    videobtn.classList.remove("selected");
})

button.addEventListener("click", async () => {
    if (mode === 1 && !recording) return startRecord();
    if (mode === 1 && recording) return mediaRecorder.stop();

    canvas.width = virtVid.clientWidth;
    canvas.height = virtVid.clientHeight;
    ctx.drawImage(video, 0, 0, virtVid.clientWidth, virtVid.clientHeight);

    const blob = dataURItoBlob(canvas.toDataURL());
    const fd = new FormData(document.forms[0]);
    fd.append("photo", blob);

    let res = await fetch(`/upload/${urlParams.get("album")}`, {
        method: 'POST',
        body: fd,
    });
    const body = await res.json();

    if (body.error) return alert(body.msg);
    window.location.replace(`/album?album=${urlParams.get("album")}`);
})

function dataURItoBlob(dataURI) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0)
        byteString = atob(dataURI.split(',')[1]);
    else
        byteString = unescape(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], {type:mimeString});
}