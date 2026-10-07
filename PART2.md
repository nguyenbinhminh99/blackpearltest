# Phần 2 — Trả lời viết

## 1. Trừ tồn kho an toàn khi 2 cửa hàng đặt cùng lúc

Giả sử bảng `inventory(sku, quantity)` và yêu cầu mỗi lần đặt phải trừ đúng số lượng nếu còn đủ.

```sql
BEGIN;

-- Khóa dòng tồn kho để request thứ hai phải chờ
SELECT quantity
FROM inventory
WHERE sku = 'TRAN_CHAU'
FOR UPDATE;

-- Chỉ trừ khi còn đủ; nếu không đủ thì không đổi số liệu
UPDATE inventory
SET quantity = quantity - 8
WHERE sku = 'TRAN_CHAU'
  AND quantity >= 8;

-- rowcount = 0 nghĩa là hết hàng / không đủ
-- ứng dụng đọc rowcount rồi commit/rollback + trả lỗi rõ ràng

COMMIT;
```

Tương đương trong NestJS/Prisma (transaction + khóa dòng):

```ts
await prisma.$transaction(async (tx) => {
  const rows = await tx.$queryRaw<{ quantity: number }[]>`
    SELECT quantity FROM inventory WHERE sku = 'TRAN_CHAU' FOR UPDATE
  `;
  if (!rows[0] || rows[0].quantity < 8) {
    throw new Error('Không đủ tồn kho');
  }
  await tx.$executeRaw`
    UPDATE inventory SET quantity = quantity - 8
    WHERE sku = 'TRAN_CHAU' AND quantity >= 8
  `;
});
```

Vì sao an toàn khi chạy đồng thời:

- `SELECT ... FOR UPDATE` giữ **row-level lock** đến hết transaction.
- Request A và B không trừ song song trên cùng một dòng; cái đến sau phải chờ cái trước commit/rollback.
- Điều kiện `quantity >= 8` là lớp bảo vệ thứ hai: dù có race ở tầng ứng dụng, DB vẫn không cho tồn âm.
- Kết hợp transaction giúp “kiểm tra + trừ” trở thành một đơn vị atomic.

Không dùng “đọc quantity rồi trừ ở app rồi update” tách rời — pattern đó dễ để cả hai request cùng thấy `10` và cùng trừ thành âm.

---

## 2. Lấy dữ liệu POS chậm (15–20 phút) mà báo cáo 7h sáng vẫn sẵn

POS không sửa được, nên hệ thống của mình phải **kéo trước, tính trước, phục vụ sau**.

Thiết kế đề xuất:

1. **Job kéo theo lịch (scheduler)**  
   - Chạy hàng đêm (ví dụ 01:00–04:00), chia theo cửa hàng/chunk thời gian để tránh một request khổng lồ.  
   - Mỗi lần kéo ghi `import_run` (bắt đầu/kết thúc, số đơn, lỗi).  
   - Retry có backoff; store lỗi không làm dừng toàn bộ batch.

2. **Upsert idempotent theo `order_id` + `updated_at`**  
   - Kéo lại an toàn; bản mới hơn ghi đè, bản cũ hơn bỏ qua.  
   - Báo cáo luôn phản ánh trạng thái mới nhất (hủy đơn, sửa tổng tiền…).

3. **Materialize báo cáo trước giờ mở**  
   - Sau khi import xong, pre-aggregate doanh thu `store × ngày (UTC+7)` vào bảng/summary hoặc xuất CSV/cache Redis.  
   - Job “chốt báo cáo ngày T-1” hoàn tất trước 06:30; đến 07:00 UI chỉ **đọc sẵn**, không gọi POS.

4. **Serving tách khỏi ingestion**  
   - API báo cáo đọc DB/cache nội bộ.  
   - Người dùng mở trang không chờ POS; nếu job đêm lỗi, hiện banner “dữ liệu chưa chốt / đang cập nhật” kèm timestamp lần kéo gần nhất.

5. **Quan sát vận hành**  
   - Alert nếu job chưa xong trước 06:30, hoặc tỷ lệ reject/mismatch bất thường.  
   - Cho phép chạy bù (re-pull 3 ngày gần nhất như `batch_2`) mà không phá số liệu nhờ upsert.

Tóm lại: báo cáo 7h sáng phụ thuộc **pipeline nội bộ đã hoàn tất**, không phụ thuộc độ trễ thời gian thực của POS tại thời điểm người dùng mở trang.
