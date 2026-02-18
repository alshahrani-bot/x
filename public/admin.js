async function loadOverview() {
  const res = await fetch('/api/office/overview');
  const data = await res.json();

  document.getElementById('stats').innerHTML = `
    <div class="stat"><strong>${data.customersCount}</strong><br/>عدد العملاء</div>
    <div class="stat"><strong>${data.workersCount}</strong><br/>عدد العاملات</div>
    <div class="stat"><strong>${data.bookingsCount}</strong><br/>إجمالي الحجوزات</div>`;

  document.getElementById('customers').innerHTML = (data.customers || []).length
    ? data.customers.map((c) => `<div>• ${c.name} - ${c.phone}</div>`).join('')
    : 'لا يوجد عملاء حتى الآن.';

  document.getElementById('bookingsTable').innerHTML = data.bookings.map((b) => `
    <tr>
      <td>${b.id}</td><td>${b.customerName}</td><td>${b.workerName}</td>
      <td>${b.date} ${b.startHour}</td><td>${b.hours} ساعة</td>
      <td><span class="badge">${b.status}</span></td>
      <td>
        <select onchange="updateStatus(${b.id}, this.value)">
          <option ${b.status === 'بانتظار التأكيد' ? 'selected' : ''}>بانتظار التأكيد</option>
          <option ${b.status === 'مؤكد' ? 'selected' : ''}>مؤكد</option>
          <option ${b.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
          <option ${b.status === 'ملغي' ? 'selected' : ''}>ملغي</option>
        </select>
      </td>
    </tr>`).join('');
}

async function updateStatus(id, status) {
  await fetch(`/api/office/bookings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  loadOverview();
}

loadOverview();
