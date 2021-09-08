require("dotenv").config();

const express = require("express");
const fileUpload = require("express-fileupload");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const AdmZip = require("adm-zip");

process.env.PORT = process.env.PORT || 8080;

if (!process.env.ZONE_ID || !process.env.TOKEN || !process.env.DOMAIN) {
	console.log("Please define these environment variables:");
	console.log("ZONE_ID=");
	console.log("TOKEN=");
	console.log("DOMAIN=");
	process.exit();
}

const app = express();

app.use(morgan("common"));

app.use(
	fileUpload({
		limits: { fileSize: 20 * 1024 * 1024 },
		abortOnLimit: true,
		responseOnLimit: "The maximum file size is 20MB",
		useTempFiles: true,
		tempFileDir: "./tmp",
	})
);

const getDomain = async () => {
	let domain = (Math.random() + 1).toString(36).substring(7);
	domain += process.env.DOMAIN;

	let response = await fetch(
		`https://api.cloudflare.com/client/v4/zones/${process.env.ZONE_ID}/dns_records`,
		{
			method: "POST",
			headers: {
				Authorization: process.env.TOKEN,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				type: "CNAME",
				name: domain,
				content: process.env.DOMAIN,
				ttl: 120,
				priority: 10,
				proxied: true,
			}),
		}
	);
	let json = await response.json();
	return json.result?.name;
};

app.post("/", async (req, res) => {
	let file = req.files?.site;
	if (
		file &&
		["application/x-zip-compressed", "application/zip"].includes(file.mimetype)
	) {
		let domain = await getDomain();
		let extracted = false;
		let hasIndex = false;
		if (domain) {
			try {
				let zip = new AdmZip(file.tempFilePath);
				let entries = zip.getEntries();
				for (let entry of entries) {
					if (entry.entryName === "index.html") {
						hasIndex = true;
						break;
					}
				}

				if (hasIndex) {
					zip.extractAllTo(path.join(__dirname, "sites", domain), true);
					extracted = true;
				}
			} catch (exception) {}
		}

		fs.unlink(file.tempFilePath, () => {
			if (!domain) {
				return res.status(400).send("Failed to get a domain name, try again!");
			} else if (!hasIndex) {
				return res
					.status(400)
					.send("The site doesn't contain an index.html file!");
			} else if (extracted) {
				console.log("Website created! " + domain);
				return res.send(domain);
			} else {
				return res.status(400).send("Invalid ZIP format!");
			}
		});
	} else {
		return res.sendStatus(404);
	}
});

app.get("*", (req, res) => {
	let hostname = req.hostname;

	if (["127.0.0.1", "localhost", "sites.filippofinke.ch"].includes(hostname)) {
		hostname = "default";
	}

	let requestedPath = req.path;
	if (requestedPath === "/") requestedPath = "index.html";

	let filePath = path.join(__dirname, "sites", hostname, requestedPath);

	if (filePath.startsWith(path.join(__dirname, "sites"))) {
		fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK, (err) => {
			if (err) {
				return res.sendStatus(404);
			}

			if (filePath.endsWith(".html")) {
				fs.readFile(filePath, { encoding: "utf-8" }, (err, data) => {
					if (err) return res.sendStatus(500);
					res.setHeader("Content-type", "text/html");
					data += `
					<div style="position: fixed; right: 10px; bottom: 10px; border-radius: 3px; box-shadow: 0 0 0 1px rgb(0 0 0 / 10%), 0 1px 3px rgb(0 0 0 / 10%); background-color: #fff; padding: 5px; font-size: 13px; cursor:pointer;">
					  <a style="color: #333333!important; text-decoration: none;" href="https://sites.filippofinke.ch">Hosted on Sites</a>
					</div>`;
					return res.send(data);
				});
			} else {
				return res.sendFile(filePath);
			}
		});
	} else {
		return res.sendStatus(400);
	}
});

app.listen(process.env.PORT, "0.0.0.0", () => {
	console.log(`app listening on port ${process.env.PORT}`);
});
