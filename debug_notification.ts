import { prisma } from "./lib/db/prisma";

async function main() {
    console.log("Checking Prisma Notification model...");
    const keys = Object.keys(prisma);
    console.log("Prisma keys found:", keys.filter(k => k.toLowerCase().includes('notification')));

    if ((prisma as any).notification) {
        console.log("✅ notification model is present in prisma object.");
    } else {
        console.log("❌ notification model is ABSENT in prisma object.");
        console.log("All prisma keys:", keys);
    }
}

main()
    .catch(err => {
        console.error("Error in debug script:", err);
    })
    .finally(async () => {
        // We don't need to disconnect since we don't connect
    });
