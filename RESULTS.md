# Kết quả chạy batch_1 → batch_2

Thời điểm chạy: 2026-10-06 (local)

## Import summary

| Batch | Rows | Inserted | Updated | Stale | Rejected |
|---|---:|---:|---:|---:|---:|
| batch_1.json | 518 | 510 | 6* | 0 | 2 |
| batch_2.json | 221 | 12 | 209 | 0 | 0 |

\* Trong `batch_1` có vài `order_id` trùng nội dung → lần gặp sau được tính `updated`.

Re-import `batch_1` sau khi đã có `batch_2`: `inserted=0`, `skipped_stale=6` (đúng 6 đơn `batch_2` đã cập nhật mới hơn — không bị ghi đè lùi).

## Bản ghi bị loại

1. `CH02-99901` — `total_amount` = `"abc"` (không phải số nguyên)
2. `XX-99902` — thiếu `store_id`

## Đối soát lệch tổng tiền

| order_id | POS | Tính lại | Chênh |
|---|---:|---:|---:|
| CH04-00032 | 118000 | 113000 | +5000 |
| CH03-00067 | 130000 | 125000 | +5000 |

## Cập nhật quan trọng từ batch_2

- 4 đơn đổi `completed` → `cancelled` (không còn tính doanh thu)
- 2 đơn sửa `total_amount` với `updated_at` mới hơn

## Doanh thu tổng (completed, ngày VN)

- Số đơn: **518**
- Doanh thu: **47.886.000 đ**

Chi tiết xem `reports/*.csv` hoặc mở http://localhost:3000
