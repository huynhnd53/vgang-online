# Mô tả gameplay: đời sống và nhân viên cửa hàng

## Context
Người dùng yêu cầu tư vấn và bản mô tả gameplay, chưa triển khai hoặc viết code. Các yêu cầu đã xác nhận: game web Three.js; đời sống tự do; đi làm nhân viên cửa hàng để kiếm tiền và xây dựng đời sống; chuyển góc nhìn thứ nhất/thứ ba; máy tính và điện thoại ngay từ đầu; mỗi trình duyệt lưu tiến độ riêng; nhịp chơi thư giãn, không thúc ép. Người dùng định hướng và kiểm thử, AI triển khai khi được yêu cầu riêng.

## Approach — chỉ hoàn thiện tư vấn
1. Trình bày bằng tiếng Việt bản mô tả gameplay bên dưới, phân biệt yêu cầu người dùng đã chọn với phạm vi và con số do trợ lý đề xuất.
2. Nêu rõ hệ quả của nhịp chơi thư giãn: không đồng hồ đếm ngược, không mức kiên nhẫn khiến khách bỏ đi, không phạt chậm, không thưởng tốc độ; tiến độ tính theo giao dịch hoàn tất. Khách thiếu hàng tiếp tục chờ và giao diện chỉ dẫn kệ cần bổ sung. Không thêm áp lực đói/khát, tiền thuê nhà hoặc mất tiền do thời gian trôi.
3. Kết thúc ở bản mô tả và khuyến nghị công nghệ: Vite + TypeScript + Three.js, HTML/CSS cho giao diện, GLB/glTF cho tài nguyên, lưu cục bộ cho dữ liệu nhỏ. Không sửa dự án, không cài phụ thuộc, không tạo scaffold hoặc chạy triển khai. Việc mở hay chấp nhận tài liệu tư vấn này không thay thế yêu cầu riêng cho phép lập trình game.

## Hướng thiết kế đề xuất
Đây là bản gameplay đề xuất để trao đổi, không phải chỉ thị triển khai. Không gian đầu gồm căn nhà nhỏ và cửa hàng; chuyển cảnh giữa hai nơi, không cần xây thành phố. Người chơi là nhân viên, không phải chủ cửa hàng. Vòng chơi: đến cửa hàng → xếp hàng và phục vụ khách → nhận lương → mua nội thất → bố trí nhà → tự chọn đi làm tiếp hoặc ở nhà.

### Một ca làm
Người chơi chủ động bắt đầu ca ở cửa hàng. Đề xuất một ca có ba giao dịch; mỗi lần một khách cần phục vụ để giới hạn hàng chờ ban đầu. Hàng thuộc cửa hàng, lấy từ khu kho, không trừ tiền người chơi. Người chơi đưa hàng lên vị trí đúng trên kệ; khách lấy hàng, đến quầy; người chơi quét từng món và xác nhận thanh toán. Giao dịch chỉ hoàn tất một lần; doanh thu không cộng vào tiền cá nhân. Hoàn tất ba giao dịch mới nhận lương ca một lần.

### Tiến triển đời sống
Đề xuất nhà có sẵn giường và đèn cơ bản; không buộc người chơi mua vật dụng thiết yếu trước khi trải nghiệm. Nội thất mua thêm gồm đèn trang trí, cây cảnh và bàn. Mua bằng danh mục tại nhà; mua xong đồ vào kho đồ cá nhân rồi được đặt/xoay tại vị trí hợp lệ. Không đặt xuyên tường, chồng đồ lên nhau hoặc chắn vùng cửa ra vào. Có thể thu hồi đồ về kho và đặt lại, không mua lại.

### Các con số minh họa
Lương một ca: 60 tiền. Đèn trang trí: 40; cây cảnh: 60; bàn: 120. Đây là số đề xuất để minh họa quan hệ một ca/một món nhỏ, hai ca/một món lớn; chưa phải cân bằng đã thử nghiệm. Không có mua bằng tiền thật, tiền thuê nhà, vay nợ hoặc bảng xếp hạng trong bản mô tả này.

### Điều khiển và lưu
Máy tính: WASD di chuyển, chuột nhìn, E tương tác, V đổi góc nhìn; giao diện menu phải giải phóng chuột. Điện thoại: joystick bên trái, vùng vuốt nhìn bên phải, nút tương tác theo ngữ cảnh và nút đổi góc nhìn. Đề xuất ưu tiên chơi ngang. Hai camera dùng chung nhân vật và trạng thái; đổi camera không đổi vị trí hoặc mất vật đang cầm. Lưu tiền, đồ sở hữu, bố trí nhà và tiến độ ca; tải lại không trả lương lặp. Lưu cục bộ không đồng bộ thiết bị và có thể mất khi xóa dữ liệu trình duyệt.

## Nhịp chơi đã xác nhận
Người dùng chọn thư giãn, không thúc ép. Khách không có giới hạn kiên nhẫn và không bỏ đi vì người chơi chậm; ca không có hạn thời gian. Không trừ tiền, hạ lương hoặc chấm điểm tốc độ. Người chơi nhận cùng mức lương cơ bản khi hoàn tất đủ giao dịch, bất kể thời gian thực hiện. Phản hồi tập trung vào việc đã làm được và đồ nội thất mới, không vào thứ hạng hoặc hiệu suất.

## Kiểm chứng gameplay khi triển khai được yêu cầu
Một kịch bản quan sát: bắt đầu với 0 tiền → hoàn tất ba giao dịch → nhận 60 → mua cây 60 → còn 0 và sở hữu một cây → đặt trong nhà → tải lại → cây đúng vị trí, tiền vẫn 0, ca đã trả lương không trả thêm. Trước khi đủ tiền, mua bàn 120 bị từ chối và không thay đổi tiền/đồ. Thử cả hai camera và điều khiển thật trên máy tính/điện thoại. Đây là tiêu chí cho triển khai tương lai, không phải kiểm chứng đã thực hiện.

## Verification — tài liệu tư vấn
Đối chiếu bản trả lời với tất cả yêu cầu trong Context và bảo đảm không có cơ chế thời gian mâu thuẫn với nhịp thư giãn. Không cần lệnh, biến môi trường hoặc thử chương trình vì đầu ra hiện tại chỉ là mô tả gameplay, không có code được thay đổi. Kịch bản ở trên là tiêu chí nghiệm thu tương lai, không được tuyên bố đã chạy hoặc đã đạt.

## Assumptions & contingencies
Ba giao dịch mỗi ca, mức lương/giá, hai địa điểm chuyển cảnh, một khách mỗi lần và chơi ngang trên điện thoại là đề xuất thiết kế có thể được người dùng thay đổi; không phải yêu cầu đã được xác nhận riêng. Giữ nguyên các giá trị này trong bản tư vấn để ví dụ nhất quán, không tự mở rộng phạm vi. Nếu được yêu cầu triển khai game sau này, phải khảo sát mã nguồn và lập kế hoạch kỹ thuật riêng; tài liệu này không xác nhận cấu trúc hay trạng thái hiện có của repository.
