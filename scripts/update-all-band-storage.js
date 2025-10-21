const { prisma } = require("../lib/prisma");
const {
  updateBandStorageUsage,
  formatBytes,
} = require("../utils/storageCalculator");

async function updateAllBandStorage() {
  console.log("Starting storage calculation for all bands...\n");

  const bands = await prisma.band.findMany({
    select: { id: true, name: true },
  });

  let totalProcessed = 0;
  let totalBytes = BigInt(0);
  let errors = 0;

  for (const band of bands) {
    try {
      const bytes = await updateBandStorageUsage(band.id);
      console.log(`✓ ${band.name}: ${formatBytes(bytes)}`);
      totalBytes += bytes;
      totalProcessed++;
    } catch (error) {
      console.error(`✗ Error processing band ${band.name}:`, error.message);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Processed: ${totalProcessed} bands`);
  console.log(`Errors: ${errors}`);
  console.log(`Total storage: ${formatBytes(totalBytes)}`);
  console.log(`${"=".repeat(50)}`);
}

updateAllBandStorage()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });

