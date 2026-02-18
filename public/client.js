let authToken = localStorage.getItem('authToken') || '';
let authMode = 'login';
let currentStep = 0;

function toggleAuth(mode) {
  authMode = mode;
  document.getElementById('loginForm').classList.toggle('hidden', mode !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', mode !== 'register');
}

function renderDots(total) {
  const dots = document.getElementById('dots');
  dots.innerHTML = Array.from({ length: total }).map((_, i) => `<span class="dot ${i === currentStep ? 'active' : ''}"></span>`).join('');
}

function showStep(index) {
  const slides = [...document.querySelectorAll('.slide')];
  currentStep = index;
  slides.forEach((s, i) => s.classList.toggle('active', i === currentStep));
  renderDots(slides.length);

  const nextBtn = document.getElementById('nextBtn');
  nextBtn.textContent = currentStep === slides.length - 1 ? 'ابدأ الآن' : 'التالي';
}

function finishOnboarding() {
  localStorage.setItem('onboardingDone', '1');
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
}

function initOnboarding() {
  const slides = document.querySelectorAll('.slide');
  const done = localStorage.getItem('onboardingDone') === '1';

  if (done) {
    finishOnboarding();
    return;
  }

  showStep(0);

  document.getElementById('skipBtn').addEventListener('click', finishOnboarding);
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentStep >= slides.length - 1) {
      finishOnboarding();
      return;
    }
    showStep(currentStep + 1);
  });
}

async function fetchWorkers() {
  const res = await fetch('/api/workers');
  const workers = await res.json();

  const workersList = document.getElementById('workersList');
  const workerSelect = document.getElementById('workerSelect');
  workersList.innerHTML = workers.map((w) => `<div class="worker-item"><b>${w.name}</b> - ${w.specialty}<br/>${w.hourlyRate} ريال / ساعة</div>`).join('');
  workerSelect.innerHTML = workers.map((w) => `<option value="${w.id}">${w.name} (${w.hourlyRate} ريال)</option>`).join('');
}

async function authRequest(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'حدث خطأ');
  return data;
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await authRequest('/api/auth/login', Object.fromEntries(form.entries()));
    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    document.getElementById('authMessage').textContent = `مرحباً ${data.customer.name}`;
  } catch (err) {
    document.getElementById('authMessage').textContent = err.message;
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await authRequest('/api/auth/register', Object.fromEntries(form.entries()));
    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    document.getElementById('authMessage').textContent = `تم إنشاء الحساب. أهلاً ${data.customer.name}`;
  } catch (err) {
    document.getElementById('authMessage').textContent = err.message;
  }
});

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!authToken) {
    document.getElementById('bookingMessage').textContent = 'يجب تسجيل الدخول قبل تأكيد الحجز.';
    return;
  }

  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());

  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  document.getElementById('bookingMessage').textContent = res.ok
    ? `تم إرسال طلب الحجز رقم ${data.id}`
    : data.message;
});

async function loadMyBookings() {
  if (!authToken) {
    document.getElementById('myBookings').textContent = 'قم بتسجيل الدخول أولاً.';
    return;
  }

  const res = await fetch('/api/my-bookings', {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const bookings = await res.json();
  if (!Array.isArray(bookings)) {
    document.getElementById('myBookings').textContent = bookings.message || 'تعذر جلب البيانات';
    return;
  }

  document.getElementById('myBookings').innerHTML = bookings.length
    ? bookings.map((b) => `<div>#${b.id} - ${b.workerName} | ${b.date} ${b.startHour} | ${b.hours} ساعة | <span class="badge">${b.status}</span></div>`).join('')
    : 'لا توجد حجوزات حتى الآن.';
}

initOnboarding();
fetchWorkers();
