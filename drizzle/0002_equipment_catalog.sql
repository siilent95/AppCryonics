CREATE TABLE "equipment_assets" (
	"model_id" text NOT NULL,
	"kind" text NOT NULL,
	"data" "bytea" NOT NULL,
	"content_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_brands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"pm_template" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "equipment_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"actor_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"event_type" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_models" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"family" text NOT NULL,
	"model" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"specifications" text DEFAULT '' NOT NULL,
	"controllers_json" text DEFAULT '[]' NOT NULL,
	"image_path" text,
	"image_scope" text DEFAULT 'family' NOT NULL,
	"image_source" text,
	"datasheet_path" text,
	"datasheet_source" text,
	"active" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment_assets" ADD CONSTRAINT "equipment_assets_model_id_equipment_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."equipment_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_brand_id_equipment_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."equipment_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_assets_model_kind_uidx" ON "equipment_assets" USING btree ("model_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_brands_name_uidx" ON "equipment_brands" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_models_identity_uidx" ON "equipment_models" USING btree ("brand_id",lower("family"),lower("model"));-- BEGIN CATALOG SEED
INSERT INTO equipment_brands (id,name,website,pm_template) VALUES ('mve','MVE','https://mvebio.com','mve'), ('taylor','Taylor-Wharton','https://icbiomedical.com','taylor');
--> statement-breakpoint
INSERT INTO equipment_models (id,brand_id,family,model,description,specifications,controllers_json,image_path,image_scope,image_source,datasheet_path,datasheet_source,active,revision) VALUES
('730942245136cc88369bf2a99e71d34d','mve','HEco 800 Series','815P-190','HEco 800 Series cryogenic storage equipment.','LN₂ capacity without inventory (estimated): 360 L
1.2 / 2 mL vial capacity: 15,600','["MVE Touch Screen","TEC 3000"]','/equipment-assets/mve-heco-800.webp','family','https://mvebio.com/wp-content/uploads/sites/4/2025/01/MVE-HEco-800-Series-Spec-Sheet-091024.pdf','/equipment-assets/mve-heco-800.pdf','https://mvebio.com/wp-content/uploads/sites/4/2025/01/MVE-HEco-800-Series-Spec-Sheet-091024.pdf',1,1),
('d450181cf8732b1036e75ef573aa5054','mve','HEco 800 Series','818P-190','HEco 800 Series cryogenic storage equipment.','LN₂ capacity without inventory (estimated): 403 L
1.2 / 2 mL vial capacity: 18,200','["MVE Touch Screen","TEC 3000"]','/equipment-assets/mve-heco-800.webp','family','https://mvebio.com/wp-content/uploads/sites/4/2025/01/MVE-HEco-800-Series-Spec-Sheet-091024.pdf','/equipment-assets/mve-heco-800.pdf','https://mvebio.com/wp-content/uploads/sites/4/2025/01/MVE-HEco-800-Series-Spec-Sheet-091024.pdf',1,1),
('c403ff6af7cbf66a5dccd0d62ce880d3','mve','HEco 800 Series','819P-190','HEco 800 Series cryogenic storage equipment.','LN₂ capacity without inventory (estimated): 446 L
1.2 / 2 mL vial capacity: 19,500','["MVE Touch Screen","TEC 3000"]','/equipment-assets/mve-heco-800.webp','family','https://mvebio.com/wp-content/uploads/sites/4/2025/01/MVE-HEco-800-Series-Spec-Sheet-091024.pdf','/equipment-assets/mve-heco-800.pdf','https://mvebio.com/wp-content/uploads/sites/4/2025/01/MVE-HEco-800-Series-Spec-Sheet-091024.pdf',1,1),
('d9939a23fac534602f690c62d63f4ff4','mve','HEco 1500 Series','1536P-190','HEco 1500 Series cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["MVE Touch Screen","TEC 3000"]','/equipment-assets/mve-heco-1500.webp','family','https://mvebio.com/wp-content/uploads/sites/4/2024/04/HEco-1500-Spec-Sheet_ML-000019-Rev-3.pdf','/equipment-assets/mve-heco-1500.pdf','https://mvebio.com/wp-content/uploads/sites/4/2024/04/HEco-1500-Spec-Sheet_ML-000019-Rev-3.pdf',1,1),
('798974ae5f8548d193017c32f4f6768b','mve','HEco 1500 Series','1539P-190','HEco 1500 Series cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["MVE Touch Screen","TEC 3000"]','/equipment-assets/mve-heco-1500.webp','family','https://mvebio.com/wp-content/uploads/sites/4/2024/04/HEco-1500-Spec-Sheet_ML-000019-Rev-3.pdf','/equipment-assets/mve-heco-1500.pdf','https://mvebio.com/wp-content/uploads/sites/4/2024/04/HEco-1500-Spec-Sheet_ML-000019-Rev-3.pdf',1,1),
('f5a2e7e58f1720152b705f25fd8c3d74','mve','HEco 1500 Series','1542R-190','HEco 1500 Series cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["MVE Touch Screen","TEC 3000"]','/equipment-assets/mve-heco-1500.webp','family','https://mvebio.com/wp-content/uploads/sites/4/2024/04/HEco-1500-Spec-Sheet_ML-000019-Rev-3.pdf','/equipment-assets/mve-heco-1500.pdf','https://mvebio.com/wp-content/uploads/sites/4/2024/04/HEco-1500-Spec-Sheet_ML-000019-Rev-3.pdf',1,1),
('d6458c310cd8826d10f7b2d8ba831a18','mve','High Efficiency 800','815P-190','High Efficiency 800 cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-he-800.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-high-efficiency-series/','/equipment-assets/mve-he-800.pdf','https://mvebio.com/wp-content/uploads/sites/4/2024/04/MVE-HE-800-Series-Spec-Sheet-01072025.pdf',1,1),
('eecc5587782695701188b3c1f098b0bc','mve','High Efficiency 800','819P-190','High Efficiency 800 cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-he-800.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-high-efficiency-series/','/equipment-assets/mve-he-800.pdf','https://mvebio.com/wp-content/uploads/sites/4/2024/04/MVE-HE-800-Series-Spec-Sheet-01072025.pdf',1,1),
('22a4cffcfa380334eb09a442ff7408e7','mve','High Efficiency 1500','1536P-190','High Efficiency 1500 cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-he-1500.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-high-efficiency-series/','/equipment-assets/mve-he-1500.pdf','https://mvebio.com/wp-content/uploads/sites/4/2024/02/MVE-HE-1500-Series-Spec-Sheet.pdf',1,1),
('8761d7c9ee026288a46f0f85bb3bbfaf','mve','High Efficiency 1500','1539P-190','High Efficiency 1500 cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-he-1500.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-high-efficiency-series/','/equipment-assets/mve-he-1500.pdf','https://mvebio.com/wp-content/uploads/sites/4/2024/02/MVE-HE-1500-Series-Spec-Sheet.pdf',1,1),
('aa18ac39a1b3232578165ce3fd23ea40','mve','High Efficiency 1500','1542R-190','High Efficiency 1500 cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-he-1500.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-high-efficiency-series/','/equipment-assets/mve-he-1500.pdf','https://mvebio.com/wp-content/uploads/sites/4/2024/02/MVE-HE-1500-Series-Spec-Sheet.pdf',1,1),
('74668c40f76a90ca49a5955eb2e6036f','mve','HE Series CryoVerse Connect','815P-190','HE Series CryoVerse Connect cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["CryoVerse Connect"]','/freezers/cryoverse-815.webp','model','https://mvebio.com/our-products/life-science-freezers/mve-he-series-cryoverse-connect-controller/','/equipment-assets/mve-cryoverse.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/03/ML-000068.pdf',1,1),
('342a0d8f133df8891a0d03905112bbbd','mve','HE Series CryoVerse Connect','1536P-190','HE Series CryoVerse Connect cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["CryoVerse Connect"]','/freezers/cryoverse-1536.webp','model','https://mvebio.com/our-products/life-science-freezers/mve-he-series-cryoverse-connect-controller/','/equipment-assets/mve-cryoverse.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/03/ML-000068.pdf',1,1),
('107906ffcf9c17114c10112591f1dbc4','mve','HE Series CryoVerse Connect','1542R-190','HE Series CryoVerse Connect cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["CryoVerse Connect"]','/freezers/cryoverse-1536.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-he-series-cryoverse-connect-controller/','/equipment-assets/mve-cryoverse.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/03/ML-000068.pdf',1,1),
('5f8fa42f118d030b8d00b3a6945a7c0c','mve','HE Series CryoVerse Connect','1892P-190','HE Series CryoVerse Connect cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["CryoVerse Connect"]','/freezers/cryoverse-1892.webp','model','https://mvebio.com/our-products/life-science-freezers/mve-he-series-cryoverse-connect-controller/','/equipment-assets/mve-cryoverse.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/03/ML-000068.pdf',1,1),
('5f54cd549ad48efc76c13cd13f15b013','mve','HE Series CryoVerse Connect','1894R-190','HE Series CryoVerse Connect cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["CryoVerse Connect"]','/freezers/cryoverse-1892.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-he-series-cryoverse-connect-controller/','/equipment-assets/mve-cryoverse.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/03/ML-000068.pdf',1,1),
('89687e3e0d1f68cffdd956568e942821','mve','MVE Series','205','MVE Series cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-series.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-series/','/equipment-assets/mve-series.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/06/ML-000074.pdf',1,1),
('47a36e32d2ed66a998cd297eea42ac47','mve','MVE Series','510','MVE Series cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-series.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-series/','/equipment-assets/mve-series.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/06/ML-000074.pdf',1,1),
('88abfe587f8edee7c8ef62df2f7c2d42','mve','MVE Series','616','MVE Series cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-series.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-series/','/equipment-assets/mve-series.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/06/ML-000074.pdf',1,1),
('d1c0c8d0fff43a7af9ceb3d1fea6621d','mve','MVE Series','1426','MVE Series cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-series.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-series/','/equipment-assets/mve-series.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/06/ML-000074.pdf',1,1),
('0448777a6cb25d1d5053328d0235a69f','mve','MVE Series','1839','MVE Series cryogenic storage equipment.','Storage medium: liquid nitrogen.
See the model column in the manufacturer datasheet for capacities and dimensions.','["TEC 3000"]','/freezers/mve-series.webp','family','https://mvebio.com/our-products/life-science-freezers/mve-series/','/equipment-assets/mve-series.pdf','https://mvebio.com/wp-content/uploads/sites/4/2026/06/ML-000074.pdf',1,1),
('69333c0fa1df20af8408bc3c6950bd3a','taylor','K-Series','3K','K-Series cryogenic storage equipment.','LN₂ capacity: 48 L
2 mL vial capacity: 3,024','["Not installed"]','/equipment-assets/ic-3k.webp','model','https://icbiomedical.com/products/k-series/','/equipment-assets/ic-k-series.pdf','https://icbiomedical.com/wp-content/uploads/2024/09/ICBiomedical_K-Series-9_24.pdf',1,1),
('7a6eb6ccf2fa45a5b20f8a43d803e627','taylor','K-Series','10K','K-Series cryogenic storage equipment.','LN₂ capacity: 165 L
2 mL vial capacity: 10,400','["CS100","CS200"]','/equipment-assets/ic-10k.webp','model','https://icbiomedical.com/products/k-series/','/equipment-assets/ic-k-series.pdf','https://icbiomedical.com/wp-content/uploads/2024/09/ICBiomedical_K-Series-9_24.pdf',1,1),
('43be1c1aa5285984e6166d863a5e6a8d','taylor','K-Series','24K','K-Series cryogenic storage equipment.','LN₂ capacity: 365 L
2 mL vial capacity: 24,050','["CS100","CS200"]','/equipment-assets/ic-24k.webp','model','https://icbiomedical.com/products/k-series/','/equipment-assets/ic-k-series.pdf','https://icbiomedical.com/wp-content/uploads/2024/09/ICBiomedical_K-Series-9_24.pdf',1,1),
('96dc6957b5e05e3e9d50041582a74c01','taylor','K-Series','38K','K-Series cryogenic storage equipment.','LN₂ capacity: 590 L
2 mL vial capacity: 38,350','["CS200"]','/equipment-assets/ic-38k.webp','model','https://icbiomedical.com/products/k-series/','/equipment-assets/ic-k-series.pdf','https://icbiomedical.com/wp-content/uploads/2024/09/ICBiomedical_K-Series-9_24.pdf',1,1),
('b2d7c1f3a4e6921fe8815eb57f07d9ed','taylor','LABS Precision','20K','Stainless-steel cryogenic freezer with PLC-based monitoring and controls.','LN₂ capacity (liquid storage): 371 L
Controller: LABS Precision PLC','["LABS Precision PLC"]',NULL,'model',NULL,'/equipment-assets/ic-labs-precision.pdf','https://icbiomedical.com/wp-content/uploads/2026/05/LABS-Precision-05_26.pdf',1,1),
('08ed3f3fdf1475fa3ebf9a89603e055f','taylor','LABS Precision','38K','Stainless-steel cryogenic freezer with PLC-based monitoring and controls.','LN₂ capacity (liquid storage): 623 L
Controller: LABS Precision PLC','["LABS Precision PLC"]',NULL,'model',NULL,'/equipment-assets/ic-labs-precision.pdf','https://icbiomedical.com/wp-content/uploads/2026/05/LABS-Precision-05_26.pdf',1,1),
('0bef027e20f34d0d38b99420b1820419','taylor','LABS Precision','40K','Stainless-steel cryogenic freezer with PLC-based monitoring and controls.','LN₂ capacity (liquid storage): 698 L
Controller: LABS Precision PLC','["LABS Precision PLC"]',NULL,'model',NULL,'/equipment-assets/ic-labs-precision.pdf','https://icbiomedical.com/wp-content/uploads/2026/05/LABS-Precision-05_26.pdf',1,1),
('13a972932b494a1eddd212c90a817418','taylor','LABS Precision','80K','Stainless-steel cryogenic freezer with PLC-based monitoring and controls.','LN₂ capacity (liquid storage): 1269 L
Controller: LABS Precision PLC','["LABS Precision PLC"]',NULL,'model',NULL,'/equipment-assets/ic-labs-precision.pdf','https://icbiomedical.com/wp-content/uploads/2026/05/LABS-Precision-05_26.pdf',1,1),
('ce8f8ca1a97272434a086202ebd20961','taylor','LABS Precision','94K','Stainless-steel cryogenic freezer with PLC-based monitoring and controls.','LN₂ capacity (liquid storage): 1595 L
Controller: LABS Precision PLC','["LABS Precision PLC"]','/equipment-assets/ic-labs-94k.webp','model','https://icbiomedical.com/wp-content/uploads/2026/05/LABS-Precision-05_26.pdf','/equipment-assets/ic-labs-precision.pdf','https://icbiomedical.com/wp-content/uploads/2026/05/LABS-Precision-05_26.pdf',1,1);
