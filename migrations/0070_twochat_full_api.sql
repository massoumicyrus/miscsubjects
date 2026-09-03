-- 0070_twochat_full_api.sql
-- Adds the full 2Chat REST surface to the directory as TWOCHAT_* rows.
-- One row per endpoint. Same shape as the existing TWOCHAT_SEND row from 0014.
-- Auth header: X-User-API-Key = $TWOCHAT_API_KEY secret.
-- URL path params and query params use positional args ($1, $2, $3, ...).
-- Bodies use the same $1, $2, ... substitution. Request bodies follow the JSON
-- shape documented in docs/2CHAT_API.md (which preserves the 2Chat developer
-- portal pages and the github.com/2ChatCo SKILL.md files verbatim).

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at, category, allowed_categories) VALUES

-- ────────────────────────────────────────────────────────────────────────────
-- Account
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_INFO', 'http',
 'GET https://api.p.2chat.io/open/info',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Verify the 2Chat API key. No args. Returns account info.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_USERS_LIST', 'http',
 'GET https://api.p.2chat.io/open/users',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List ACTIVE users on the 2Chat account. Returns each user uuid, first_name, last_name, email. Used to mint per-user Voice SDK JWTs.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- WhatsApp Web — channels (numbers)
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_CHANNEL_CREATE', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/channel/create',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Create a WhatsApp Web channel. $1=phone_number (E.164) $2=friendly_name. Returns channel uuid with connection_status=D awaiting QR scan.
{"phone_number":"$1","friendly_name":"$2"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CHANNEL_QR', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/channel/$1/qr-code',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get the current QR code for a channel. $1=channel_uuid. Returns qr_code (raw string) and qr_code_image_url (PNG). QR refreshes server-side — do NOT poll faster than every 5 seconds.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CHANNEL_CONNECT', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/channel/$1/connect',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Bring a channel online and trigger a QR code. $1=channel_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CHANNEL_DISCONNECT', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/channel/$1/disconnect',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Take a channel offline without deleting it. $1=channel_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CHANNEL_DELETE', 'http',
 'DELETE https://api.p.2chat.io/open/whatsapp/channel/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Permanently delete a channel. $1=channel_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CHANNEL_GET', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/channel/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get full details of one connected number. $1=channel_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_LIST', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/get-numbers?status=$1&page_number=$2&results_per_page=$3',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List connected WhatsApp numbers. $1=status (connected|disconnected|all) $2=page_number (0-based) $3=results_per_page (default 50, max 200).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- WhatsApp Web — check number
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_CHECK_NUMBER', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/check-number/$1/$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Check if a phone number is on WhatsApp. $1=your_connected_number (E.164) $2=number_to_check (E.164). Billed as 1 API call. Returns is_valid, on_whatsapp, number.{iso_country_code,region,carrier,timezone}. Always send to whatsapp_info.number_id (NOT the dialed number) when it differs.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CHECK_NUMBER_EXTRA', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/check-number/$1/$2?extra-information=true',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Same as TWOCHAT_CHECK_NUMBER but also returns whatsapp_info (profile pic, business info, verified level, status_text). Billed as 2 API calls. Trial cap 10/min and 100 lifetime; paid 30/min PER connected number.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- WhatsApp Web — send / messages / conversations
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_SEND_MEDIA', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/send-message',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Send a WhatsApp media message. $1=from_number $2=to_number $3=public_media_url (image/video/PDF/audio, MAX 16 MB, must be publicly reachable at send time).
{"from_number":"$1","to_number":"$2","url":"$3"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_SEND_GROUP', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/send-message',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Send a WhatsApp message to a group. $1=from_number $2=to_group_uuid (e.g. WAG768beeef-…) $3=text. Cannot combine with to_number.
{"from_number":"$1","to_group_uuid":"$2","text":"$3"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_SEND_PIN', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/send-message',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Send a GPS map pin. $1=from_number $2=to_number $3=latitude $4=longitude $5=name $6=address $7=url.
{"from_number":"$1","to_number":"$2","pin":{"latitude":"$3","longitude":"$4","name":"$5","address":"$6","url":"$7"}}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_MESSAGES_ALL', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/messages/$1?page_number=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get all WhatsApp messages on a channel. $1=your_connected_number (E.164) $2=page_number (0-based, 100 per page). Only messages after the channel was connected to 2Chat are visible.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_MESSAGES_LIST', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/messages/$1/$2?page_number=$3',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get the WhatsApp chat history with one contact. $1=your_connected_number (E.164) $2=remote_number (E.164) $3=page_number (0-based, 100 per page).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_MESSAGE_GET', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/message/$1/$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get one WhatsApp message including delivery status. $1=session_key (e.g. WW-WPN…-…@c.us) $2=message_uuid. Returns wa_msg_ack: 0=created, 1=sent, 2=received, 3=read.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_MESSAGE_DELETE', 'http',
 'DELETE https://api.p.2chat.io/open/whatsapp/message/$1/$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Delete a WhatsApp message. $1=session_key $2=message_uuid. Only allowed within 60 hours of sending. Non-admins can only delete their own messages in groups.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CONVERSATIONS_LIST', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/conversations/$1?page_number=$2&phone_number=$3',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List WhatsApp conversations for a channel, newest first. $1=channel_uuid $2=page_number (0-based, 10 per page) $3=optional 3-20 digit substring to filter by phone number.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- WhatsApp Web — profile
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_SET_PROFILE_PIC', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/set-profile-picture/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Update WhatsApp profile photo. $1=your_connected_number (E.164) $2=public_image_url (or pass null to remove).
{"url":"$2"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_SET_STATUS', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/set-status/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Update WhatsApp About text. $1=your_connected_number (E.164) $2=status_text.
{"status":"$2"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- WhatsApp Web — groups
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_GROUP_LIST', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/groups/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List WhatsApp groups visible to a connected number. $1=your_connected_number (E.164). Only groups joined AFTER 2Chat connection appear. Initial sync 5–30 minutes.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_GET', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/group/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get group metadata and full participant list. $1=group_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_MESSAGES', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/groups/messages/$1?page_number=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get group chat history. $1=group_uuid $2=page_number (0-based, 50 per page, newest first). Only post-connection messages.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_CREATE', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/group/create',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Create a WhatsApp group. $1=from_number $2=group_name $3=group_description $4=participants_csv (E.164 numbers separated by commas, MAX 10 initial participants). For more than 10, use TWOCHAT_GROUP_ADD afterwards.
{"from_number":"$1","group":{"name":"$2","description":"$3","participants":[$4]}}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_ADD', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/group/$1/add-participant',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Add up to 10 participants to a group. $1=group_uuid $2=from_number $3=participants_csv (E.164 numbers, MAX 10).
{"from_number":"$2","participants":[$3]}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_REMOVE', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/group/$1/remove-participant',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Remove up to 10 participants from a group. $1=group_uuid $2=from_number $3=participants_csv (E.164 numbers, MAX 10).
{"from_number":"$2","participants":[$3]}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_PROMOTE', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/group/$1/promote-participant',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Promote up to 10 participants to admin. $1=group_uuid $2=from_number $3=participants_csv (E.164 numbers, MAX 10). Propagation may take a few minutes.
{"from_number":"$2","participants":[$3]}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_DEMOTE', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/group/$1/demote-participant',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Demote up to 10 participants from admin. $1=group_uuid $2=from_number $3=participants_csv (E.164 numbers, MAX 10).
{"from_number":"$2","participants":[$3]}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_SET_DESC', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/group/$1/set-description',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Update a group description. $1=group_uuid $2=from_number $3=new_description.
{"from_number":"$2","description":"$3"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_GROUP_SET_PIC', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/group/$1/set-picture',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Update a group photo. $1=group_uuid $2=from_number $3=public_image_url.
{"from_number":"$2","url":"$3"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- WABA (WhatsApp Business API)
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_WABA_TEMPLATES', 'http',
 'GET https://api.p.2chat.io/open/waba/templates?phone_number=$1&page=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List WABA message templates. $1=waba_phone_number (E.164) $2=page (0-based, paginated via next_page). Each template has uuid, name, status (APPROVED|PENDING|REJECTED|FAILED), category, template_content.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_WABA_SEND', 'http',
 'POST https://api.p.2chat.io/open/waba/send-message',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Send a WABA template message. $1=from_number $2=to_number $3=template_uuid $4=body_params_csv (values for {{1}},{{2}}…) $5=header_value $6=buttons_json (use {} when none). params is REQUIRED even when empty.
{"from_number":"$1","to_number":"$2","template_uuid":"$3","params":{"body":[$4],"header":"$5","buttons":$6}}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_WABA_SEND_TEXT', 'http',
 'POST https://api.p.2chat.io/open/waba/send-message',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Send a WABA free-form session text (only valid inside the 24-hour conversation window). $1=from_number $2=to_number $3=text.
{"from_number":"$1","to_number":"$2","text":"$3"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- WhatsApp Catalog — products
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_CATALOG_PRODUCTS_LIST', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/catalog/products?from_number=$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List products in your WhatsApp Business catalog. $1=your_connected_number (E.164). Each product has id, name, price, currency, images, approval_status (PENDING|OUTDATED|REJECTED|APPROVED).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_PRODUCTS_OTHER', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/catalog/products/$1?from_number=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List products in another business''s catalog. $1=target_business_number (E.164) $2=your_connected_number (E.164).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_PRODUCT_ADD', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/catalog/product',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Add a catalog product (FIRST product must be added through the WhatsApp app, not the API). $1=from_number $2=name $3=image_url $4=description $5=price $6=currency $7=is_hidden $8=product_url $9=retailer_id.
{"from_number":"$1","product":{"name":"$2","image_url":"$3","description":"$4","price":"$5","currency":"$6","is_hidden":$7,"url":"$8","retailer_id":"$9"}}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_PRODUCT_EDIT', 'http',
 'PUT https://api.p.2chat.io/open/whatsapp/catalog/product/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Edit a catalog product. $1=product_id $2=from_number $3=name $4=image_url $5=description $6=price $7=is_hidden $8=product_url $9=retailer_id. name and image_url CANNOT be null. Edits re-enter WhatsApp verification.
{"from_number":"$2","product":{"name":"$3","image_url":"$4","description":"$5","price":"$6","is_hidden":$7,"url":"$8","retailer_id":"$9"}}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_PRODUCT_DELETE', 'http',
 'DELETE https://api.p.2chat.io/open/whatsapp/catalog/product/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Delete a catalog product. $1=product_id $2=from_number.
{"from_number":"$2"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_PRODUCT_IMG_ADD', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/catalog/product/image/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Add up to 2 extra product images. $1=product_id $2=from_number $3=image_url_1 $4=image_url_2. Does NOT replace the default image.
{"from_number":"$2","product":{"image_urls":["$3","$4"]}}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_PRODUCT_IMG_DEL', 'http',
 'DELETE https://api.p.2chat.io/open/whatsapp/catalog/product/image/$1/$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Delete a non-default product image. $1=product_id $2=image_index (0-based) $3=from_number. The default product image cannot be deleted — replace it via TWOCHAT_CATALOG_PRODUCT_EDIT instead.
{"from_number":"$3"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- WhatsApp Catalog — collections
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_CATALOG_COLLECTIONS_LIST', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/catalog/collections?from_number=$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List your catalog collections (with nested products). $1=your_connected_number (E.164).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_COLLECTIONS_OTHER', 'http',
 'GET https://api.p.2chat.io/open/whatsapp/catalog/collections/$1?from_number=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List another business''s catalog collections. $1=target_business_number (E.164) $2=your_connected_number (E.164).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_COLLECTION_ADD', 'http',
 'POST https://api.p.2chat.io/open/whatsapp/catalog/collection',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Create a catalog collection. $1=from_number $2=collection_name $3=product_ids_csv (product ids from TWOCHAT_CATALOG_PRODUCTS_LIST). The name cannot be changed later — delete and recreate to rename.
{"from_number":"$1","collection":{"name":"$2","product_ids":[$3]}}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_COLLECTION_EDIT', 'http',
 'PUT https://api.p.2chat.io/open/whatsapp/catalog/collection/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Edit a catalog collection. $1=collection_id $2=from_number $3=remove_product_ids_csv $4=add_product_ids_csv. The collection_id CHANGES every edit — capture the new id from the response before the next call.
{"from_number":"$2","collection":{"remove_product_ids":[$3],"add_product_ids":[$4]}}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CATALOG_COLLECTION_DELETE', 'http',
 'DELETE https://api.p.2chat.io/open/whatsapp/catalog/collection/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Delete a catalog collection. $1=collection_id $2=from_number.
{"from_number":"$2"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- Virtual numbers — search and purchase
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_NUMBERS_REGIONS', 'http',
 'GET https://api.p.2chat.io/open/numbers/regions?country=$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List regions for a country. $1=ISO country code. Regions only exist for US, CA, GB. Required for US searches.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_CITIES', 'http',
 'GET https://api.p.2chat.io/open/numbers/cities?country=$1&region=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List cities. $1=ISO country code $2=region_id (optional — omit to return all cities for the country).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_DID_TYPES', 'http',
 'GET https://api.p.2chat.io/open/numbers/did-types',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List DID types: local, mobile, tollfree, national, global, sharedcost.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_REQUIREMENTS', 'http',
 'GET https://api.p.2chat.io/open/numbers/requirements?country=$1&did_type=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Country-specific identity / proof-of-address requirements. $1=ISO country code $2=did_type_id (optional). Empty array = no documents needed. Buying without meeting requirements can result in the number being suspended.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_GROUPS', 'http',
 'GET https://api.p.2chat.io/open/numbers/groups?country=$1&region_id=$2&city_id=$3&city_name_or_prefix=$4&did_type=$5',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Search number groups (the main search). $1=ISO country code $2=region_id $3=city_id $4=city_name_or_prefix $5=did_type (local|mobile|tollfree|national|global|sharedcost|all). Returns groups with id, prefix, location, price.{setup_price,monthly_price,ppm}, type, requirements[], allow_number_selection, features[] (voice|sms_in|sms_out|whatsapp|whatsapp_business).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_AVAILABLE', 'http',
 'GET https://api.p.2chat.io/open/numbers/available?group_id=$1&number_contains=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Browse specific numbers in a group (only when group.allow_number_selection=true). $1=group_id $2=number_contains (optional digits substring for vanity-number search).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_RESERVE', 'http',
 'POST https://api.p.2chat.io/open/numbers/reservations',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Reserve a number. $1=group_id $2=number (optional — random pick if omitted). Reservations expire — always purchase before expires_at.
{"group_id":"$1","number":"$2"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_RESERVATIONS_LIST', 'http',
 'GET https://api.p.2chat.io/open/numbers/reservations',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List active number reservations on the account.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_RESERVATION_CANCEL', 'http',
 'DELETE https://api.p.2chat.io/open/numbers/reservations/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Cancel a reservation. $1=reservation_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_NUMBERS_PURCHASE', 'http',
 'POST https://api.p.2chat.io/open/numbers/purchase',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Purchase numbers. $1=number (optional — if omitted, purchases ALL active reservations; if matched to an existing reservation, that reservation is used; otherwise checks availability on the fly).
{"number":"$1"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_VOIP_VIRTUAL_NUMBER_DELETE', 'http',
 'DELETE https://api.p.2chat.io/open/voip/virtual-numbers/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Mark an owned virtual number as pending cancellation. $1=virtual_number_uuid (format: DID + 36-char UUID, e.g. DID01234567-89ab-cdef-0123-456789abcdef). NOTE the path is /voip/virtual-numbers/ NOT /numbers/.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- VoIP — calls and virtual numbers
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_CALL_HISTORY', 'http',
 'GET https://api.p.2chat.io/open/voip/call-history?page_number=$1&direction=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List call detail records. $1=page_number $2=direction (inbound|outbound). Each CDR has uuid, direction (O outbound | I inbound), status, to_number, caller_id_used, duration (seconds), recording_url, start_time, end_time, agent_id, call_cost.call_price (USD).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CALL_GET', 'http',
 'GET https://api.p.2chat.io/open/voip/call/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get one CDR. $1=call_uuid. Returns agent and call_cost detail.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_VIRTUAL_NUMBERS_LIST', 'http',
 'GET https://api.p.2chat.io/open/voip/virtual-numbers?page_number=$1&results_per_page=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List owned virtual numbers. $1=page_number $2=results_per_page (default 50). Each number has phone_number, iso_country_code, friendly_name, record_inbound, is_toll_free, incoming_price_per_minute, status_text (ACTIVE|AWAITING_REGISTRATION|PENDING_ACTIVATION|PENDING_CANCELLATION|RELEASED).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CALLER_IDS_LIST', 'http',
 'GET https://api.p.2chat.io/open/voip/caller-ids?page_number=$1&results_per_page=$2',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List caller IDs. $1=page_number $2=results_per_page (default 50). Types: VN (virtual number on 2Chat) | WW (connected WhatsApp Web) | WA (WABA number) | CI (imported custom).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- Contacts
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_CONTACTS_LIST', 'http',
 'GET https://api.p.2chat.io/open/contacts?page_number=$1&results_per_page=$2&channel_uuid=$3',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List contacts. $1=page_number $2=results_per_page (1-100) $3=channel_uuid (optional — scope to one connected number).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CONTACT_GET', 'http',
 'GET https://api.p.2chat.io/open/contacts/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Get one contact. $1=contact_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CONTACTS_SEARCH', 'http',
 'GET https://api.p.2chat.io/open/contacts/search?q=$1&channel_uuid=$2&page_number=$3&results_per_page=$4',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Search contacts. $1=query (matches name or phone) $2=channel_uuid (optional scope) $3=page_number $4=results_per_page (1-100).',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CONTACT_CREATE', 'http',
 'POST https://api.p.2chat.io/open/contacts',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Create a contact. $1=first_name $2=last_name $3=profile_pic_url $4=channel_uuid (sync to a connected number) $5=contact_detail_json (array of {type,value}; type ∈ PH phone | WAPH WhatsApp phone | E email | A address; phone values must be E.164).
{"first_name":"$1","last_name":"$2","profile_pic_url":"$3","channel_uuid":"$4","contact_detail":$5}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CONTACT_UPDATE', 'http',
 'PUT https://api.p.2chat.io/open/contacts/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Update a contact. $1=contact_uuid $2=first_name $3=last_name $4=profile_pic_url $5=channel_uuid (changing this re-syncs) $6=contact_details_json.
{"first_name":"$2","last_name":"$3","profile_pic_url":"$4","channel_uuid":"$5","contact_details":$6}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_CONTACT_DELETE', 'http',
 'DELETE https://api.p.2chat.io/open/contacts/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Permanently delete a contact. $1=contact_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- SMS
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_SMS_SEND', 'http',
 'POST https://api.p.2chat.io/open/sms/send',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Send a plain SMS. $1=from_number (must be SMS-enabled on the account, E.164) $2=to_number (E.164) $3=text (UTF-8). >160 chars splits into multiple billed segments. A2P US messaging not supported. HTTP 202 on accept.
{"from_number":"$1","to_number":"$2","text":"$3"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

-- ────────────────────────────────────────────────────────────────────────────
-- Webhooks
-- ────────────────────────────────────────────────────────────────────────────
('TWOCHAT_WEBHOOK_SUBSCRIBE_WW', 'http',
 'POST https://api.p.2chat.io/open/webhooks/subscribe/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Subscribe to a WhatsApp event. $1=event_name (e.g. whatsapp.message.received, whatsapp.message.sent, whatsapp.call.received, whatsapp.group.message.received, whatsapp.number.status, etc.) $2=hook_url (publicly reachable) $3=on_number (E.164 connected number) $4=to_group_uuid (optional — restrict group events to one group; default any) $5=time_period (REQUIRED only for whatsapp.conversation.new: all-time|hour|day|week|month|year).
{"hook_url":"$2","on_number":"$3","to_group_uuid":"$4","time_period":"$5"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_WEBHOOK_SUBSCRIBE_CALL', 'http',
 'POST https://api.p.2chat.io/open/webhooks/subscribe/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
 '# Subscribe to a phone-call event. $1=event_name (call.status.update | call.incoming.completed | call.outbound.completed) $2=hook_url $3=channel_uuid (virtual-number UUID).
{"hook_url":"$2","channel_uuid":"$3"}',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_WEBHOOKS_LIST', 'http',
 'GET https://api.p.2chat.io/open/webhooks',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List every enabled webhook on the account. Returns uuid, event_name, channel_uuid, hook_url, hook_params, created_at per row.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_WEBHOOKS_BY_CHANNEL', 'http',
 'GET https://api.p.2chat.io/open/webhooks/channel/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# List webhooks for one channel. $1=channel_uuid.',
 '2026-06-12T22:00:00Z', 'twochat', NULL),

('TWOCHAT_WEBHOOK_DELETE', 'http',
 'DELETE https://api.p.2chat.io/open/webhooks/$1',
 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY"}',
 '# Delete a webhook subscription. $1=webhook_uuid (get it from TWOCHAT_WEBHOOKS_LIST).',
 '2026-06-12T22:00:00Z', 'twochat', NULL);
