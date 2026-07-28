-- Keep historical listings readable while requiring complete commercial terms on
-- every new Product insert or update. NOT VALID avoids rewriting legacy rows.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_retail_price_required_check"
  CHECK ("priceMax" IS NOT NULL AND "priceMax" > 0) NOT VALID;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_wholesale_price_required_check"
  CHECK ("priceMin" IS NOT NULL AND "priceMin" > 0) NOT VALID;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_wholesale_not_above_retail_check"
  CHECK ("priceMin" <= "priceMax") NOT VALID;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_currency_required_check"
  CHECK (btrim("currency") <> '') NOT VALID;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_moq_quantity_positive_integer_check"
  CHECK (btrim("moqQuantity") ~ '^[1-9][0-9]*$') NOT VALID;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_moq_unit_required_check"
  CHECK (btrim("moqUnit") <> '' AND "moqUnit" <> 'Not fixed') NOT VALID;
