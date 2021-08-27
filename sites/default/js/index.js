let notyf = new Notyf({
	position: {
		x: "center",
		y: "bottom",
	},
	duration: 3000,
});
let progress = document.getElementById("progress");

const upload = (file) => {
	let req = new XMLHttpRequest();
	req.onreadystatechange = () => {
		if (req.readyState === 4) {
			if (req.status === 200) {
				notyf.success("Site uploaded!");
				let domain = "https://" + req.responseText;
				progress.innerHTML = "100% 🚀<br><p>Waiting for the domain...</p>";
				let interval = setInterval(async () => {
					try {
						await fetch(domain, {
							method: "HEAD",
							mode: "no-cors",
						});
						clearInterval(interval);
						window.location.href = domain;
					} catch (exception) {}
				}, 1000);
			} else {
				notyf.error(req.responseText);
				progress.style.height = 0;
				progress.innerText = "";
			}
		}
	};
	req.upload.addEventListener("progress", (p) => {
		let percent = Math.floor((p.loaded / p.total) * 100) + "%";
		progress.style.height = percent;
		progress.innerText = percent + " 🚀";
	});
	let data = new FormData();
	data.append("site", file);
	req.open("POST", "/", true);
	req.send(data);
};

window.addEventListener("dragover", (event) => {
	event.preventDefault();
});

window.addEventListener("drop", (event) => {
	event.preventDefault();
	let file = event.dataTransfer.files[0];
	if (
		file &&
		["application/x-zip-compressed", "application/zip"].includes(file.type)
	) {
		upload(file);
	} else {
		notyf.error("Please drop a .zip file!");
	}
});
