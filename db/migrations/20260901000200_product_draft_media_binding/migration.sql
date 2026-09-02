-- S2 商品草稿媒体绑定：商品图片必须可追溯至同租户已确认媒体资产。
ALTER TABLE commerce.product_images
  ADD COLUMN media_asset_id UUID;

CREATE UNIQUE INDEX product_images_media_asset_id_key
  ON commerce.product_images(media_asset_id)
  WHERE media_asset_id IS NOT NULL;

ALTER TABLE commerce.product_images
  ADD CONSTRAINT product_images_media_asset_id_fkey
  FOREIGN KEY (media_asset_id)
  REFERENCES shared.media_assets(id)
  ON DELETE RESTRICT;
