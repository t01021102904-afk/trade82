ALTER TABLE "Product"
ADD COLUMN "field_visibility" JSONB NOT NULL DEFAULT '{
  "minimumUnitPrice": "inquiry_required",
  "moq": "inquiry_required",
  "leadTime": "inquiry_required",
  "sampleAvailability": "public",
  "privateLabelAvailability": "inquiry_required",
  "monthlySupplyCapacity": "inquiry_required",
  "incoterms": "inquiry_required",
  "hsCode": "inquiry_required",
  "shelfLife": "inquiry_required",
  "storageRequirements": "inquiry_required",
  "documents": "inquiry_required",
  "complianceInfo": "inquiry_required",
  "ingredientsMaterials": "inquiry_required",
  "packageSize": "inquiry_required",
  "unitsPerCarton": "inquiry_required",
  "cartonWeight": "inquiry_required",
  "cartonDimensions": "inquiry_required",
  "palletQuantity": "inquiry_required",
  "storageTemperature": "inquiry_required",
  "packaging": "inquiry_required"
}'::jsonb;
