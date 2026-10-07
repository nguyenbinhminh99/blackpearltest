# POS ETL — Bài test Full-stack Black Pearl

Hệ thống kéo dữ liệu bán hàng từ file JSON (mô phỏng POS), lưu PostgreSQL theo kiểu **idempotent upsert**, và xuất báo cáo doanh thu / thiếu dữ liệu / đối soát / bản ghi lỗi.

## Chạy nhanh bằng Docker (khuyến nghị)

Yêu cầu: Docker Desktop đã cài và đang chạy.

```bash
git clone https://github.com/nguyenbinhminh99/blackpearltest.git
cd blackpearltest
docker compose up --build
```

Nếu lần trước bị lỗi cổng / container cũ:

```bash
docker compose down
docker compose up --build --force-recreate
```

Sau khi lên:

1. Mở báo cáo web: http://localhost:3000
2. File CSV nằm trong thư mục `reports/` trên máy bạn (được mount từ container)
3. API:
   - `POST /import` body `{"path":"data/batch_1.json"}`
   - `GET /reports/revenue`
   - `GET /reports/missing`
   - `GET /reports/reconcile`
   - `GET /reports/rejected`
   - `POST /reports/export-csv`

Container sẽ:

1. Migrate DB
2. Import `data/batch_1.json` rồi `data/batch_2.json`
3. Xuất CSV vào `reports/`
4. Chạy web + API cổng 3000

Tắt auto-import:

```bash
AUTO_IMPORT=0 docker compose up --build
```

## Chạy local (không Docker app)

```bash
# 1) Bật Postgres (map cổng host 5433 → container 5432)
docker compose up -d db

# 2) Cài dependency
npm install

# 3) Migrate
npx prisma migrate deploy
npx prisma generate

# 4) Import batch_1 → batch_2 và xuất CSV
npm run import -- data/batch_1.json data/batch_2.json --export

# 5) Chạy web
npm run start:dev
```

Mở http://localhost:3000

## Quy tắc xử lý dữ liệu

| Quy tắc | Cách làm |
|---|---|
| `order_id` duy nhất | PK; upsert theo `order_id` |
| Bản mới hơn thắng | Chỉ update khi `updated_at` mới ≥ bản đang có |
| Chạy lại cùng file | Không làm sai số liệu (idempotent) |
| Bản ghi hỏng | Không crash; ghi `import_errors` kèm lý do |
| Doanh thu | Chỉ `status = completed`, theo `total_amount` |
| Ngày báo cáo | Đổi `created_at` UTC → ngày VN (UTC+7) |
| Đối soát | So `total_amount` với Σ(qty × (unit_price + topping)) − discount |

### Lỗi đã phát hiện trong dữ liệu giả lập

- `CH02-99901`: `total_amount = "abc"` → **reject**
- `XX-99902`: thiếu `store_id` → **reject**
- `CH04-00032`, `CH03-00067`: tổng tiền lệch công thức → **nhập vào DB**, hiện ở báo cáo đối soát
- Trong batch có vài `order_id` trùng (nội dung giống nhau) → upsert an toàn
- `batch_2` cập nhật một số đơn: hủy đơn / sửa `total_amount` với `updated_at` mới hơn → ghi đè đúng

## Cấu trúc chính

```
src/import/     # đọc JSON, validate, upsert
src/reports/    # doanh thu, missing, reconcile, rejected, CSV
public/         # trang web lọc cửa hàng + ngày
data/           # batch_1.json, batch_2.json
reports/        # CSV sau khi import --export
PART2.md        # câu trả lời phần 2
```

## Kết quả mẫu sau `batch_1` → `batch_2`

Xem `RESULTS.md` và thư mục `reports/`:

- `revenue_by_store_date.csv`
- `missing_data_warnings.csv`
- `reconcile_mismatches.csv`
- `rejected_records.csv`

## Phần 2

Xem file `PART2.md` (trừ tồn kho concurrent + thiết kế kéo POS trước 7h sáng).
