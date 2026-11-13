-- AlterTable
ALTER TABLE "Equipment" ALTER COLUMN "availableQuantity" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "description" TEXT;
