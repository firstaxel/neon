import { configureR2Cors } from "../src/features/upload/lib/s3";

async function main() {
	console.log("Configuring CORS policy on Cloudflare R2 bucket...");
	try {
		await configureR2Cors();
		console.log("✅ Successfully configured CORS on Cloudflare R2 bucket!");
	} catch (err) {
		console.error("❌ Failed to set CORS on R2 bucket via S3 API:", err);
		console.log(
			"\nIf your R2 API token lacks bucket-level admin permissions, you can configure CORS directly in the Cloudflare Dashboard:"
		);
		console.log(
			"1. Go to Cloudflare Dashboard > R2 > Select bucket 'bulk-messaging'"
		);
		console.log("2. Click Settings tab > CORS Policy > Add CORS Policy");
		console.log("3. Paste the following JSON:");
		console.log(
			JSON.stringify(
				[
					{
						AllowedHeaders: ["*"],
						AllowedMethods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
						AllowedOrigins: [
							"http://localhost:3000",
							"http://127.0.0.1:3000",
							"*",
						],
						ExposeHeaders: ["ETag"],
						MaxAgeSeconds: 3600,
					},
				],
				null,
				2
			)
		);
	}
}

main();
