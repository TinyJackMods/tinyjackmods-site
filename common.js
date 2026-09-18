// ============ LENIS — инерционная прокрутка ============
(function initLenis() {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lenis@1.1.14/dist/lenis.min.js';
    script.onload = () => {
        const lenis = new Lenis({
            duration: 0.9,            // было 1.4 — короче инерция, легче ощущение
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,        // инерция от колеса мыши
            wheelMultiplier: 1,       // было 0.9 — стандартная отзывчивость колеса
            smoothTouch: false,
            touchMultiplier: 1.5
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        window.scrollToTop = () => lenis.scrollTo(0, { duration: 0.9 });

        // Плавная прокрутка к якорям
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="#"]');
            if (!link) return;
            const id = link.getAttribute('href').slice(1);
            if (!id) return;
            const target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            lenis.scrollTo(target, { offset: -80, duration: 0.9 });
        });

        document.documentElement.classList.add('lenis');
    };
    document.head.appendChild(script);
})();

// ===== Модалки =====
function openApplyModal() {
    document.getElementById('applyModal').classList.remove('hidden');
}
function openDiscordModal() {
    document.getElementById('discordModal').classList.remove('hidden');
}
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// ===== Формы и заглушки =====
function handleApplySubmit(event) {
    event.preventDefault();
    closeModal('applyModal');
    showToast('Заявка успешно отправлена команде TJM!');
    event.target.reset();
}

function downloadMod(projectName) {
    showToast('Загрузка модификации "' + projectName + '" началась!');
}

let isDiscordConnected = false;
function simulateDiscordAuth() {
    const btn = document.getElementById('discordAuthBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Авторизация...';

    setTimeout(() => {
        isDiscordConnected = true;
        closeModal('discordModal');
        showToast('Discord аккаунт успешно привязан!');

        const nav = document.getElementById('discordNavBtn');
        if (nav) {
            nav.classList.add('border-emerald-500/50', 'text-emerald-400');
            document.getElementById('discordNavText').textContent = 'Discord Подключен';
        }
        btn.innerHTML = '<i class="fa-brands fa-discord"></i> Войти через Discord';
    }, 1200);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast) return;
    toastMessage.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
    }, 3200);
}

window.addEventListener('click', function(event) {
    ['applyModal', 'discordModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && event.target === modal) closeModal(id);
    });
});

// ===== Анимация дыма на canvas =====
window.addEventListener('load', function() {
    const canvas = document.getElementById('smokeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    });

    const particles = Array.from({ length: 25 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 80 + 40,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.3 - 0.1,
        alpha: Math.random() * 0.3 + 0.1
    }));

    function animateSmoke() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y + p.radius < 0) {
                p.y = height + p.radius;
                p.x = Math.random() * width;
            }
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            grad.addColorStop(0, `rgba(200, 30, 45, ${p.alpha})`);
            grad.addColorStop(1, 'rgba(10, 5, 8, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        requestAnimationFrame(animateSmoke);
    }
    animateSmoke();
});
document.addEventListener("DOMContentLoaded", () => {
    checkSteamAuth();
});

function checkSteamAuth() {
    const steamUserStr = localStorage.getItem('steamUser');
    const steamBtn = document.getElementById('steamNavBtn');
    const steamText = document.getElementById('steamNavText');

    if (!steamBtn || !steamText) return;

    try {
        const steamUser = steamUserStr ? JSON.parse(steamUserStr) : null;

        if (steamUser && steamUser.isLoggedIn) {
            steamText.textContent = steamUser.name || 'Steam Профиль';
            steamBtn.classList.remove('bg-cardBg', 'border-cardBorder', 'text-gray-200');
            steamBtn.classList.add('bg-emerald-950/40', 'border-emerald-500/50', 'text-emerald-300');
            
            // Используем абсолютный путь от корня сервера, чтобы ссылка работала с любой страницы!
            steamBtn.href = '/Profile/index.html';
            steamBtn.onclick = null;
        }
    } catch (e) {
        console.error('Ошибка чтения данных Steam из localStorage:', e);
    }
}