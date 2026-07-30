-- A client-generated ID lets the message endpoint safely replay a request after
-- a timeout or lost response without creating a second business message.
ALTER TABLE "Message" ADD COLUMN "clientMessageId" TEXT;

CREATE UNIQUE INDEX "Message_senderCompanyId_clientMessageId_key"
  ON "Message"("senderCompanyId", "clientMessageId");
