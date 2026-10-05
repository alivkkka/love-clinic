import { getContext, extension_settings } from "../../../extensions.js";
import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";

const extensionName = "love-clinic";
let currentKinks = [];

// Инициализация настроек
if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = { manualKinks: "", x: null, y: 100 };
}

// Словарь кинков (по примеру HeartPulse)
const KINK_KEYWORDS = {
    dominance: ['dominant', 'domination', 'controlling', 'доминир', 'власть', 'контролир'],
    submission: ['submissive', 'submission', 'подчинен', 'послушн'],
    bondage: ['bondage', 'restrain', 'tie up', 'ropes', 'бондаж', 'связ', 'верев', 'фиксац'],
    praise: ['praise kink', 'good girl', 'good boy', 'похвал', 'умница'],
    teasing: ['tease', 'teasing', 'provok', 'дразн', 'провоцир'],
    public: ['public sex', 'public place', 'getting caught', 'публич', 'риск быть замечен'],
    voyeurism: ['voyeur', 'watching', 'being watched', 'вуайер', 'подглядыв'],
    spanking: ['spank', 'slapping', 'шлеп', 'по заднице'],
    biting: ['bite', 'biting', 'nibble', 'укусы', 'куса'],
    hair: ['hair pull', 'pulling hair', 'волос', 'за волосы'],
    blindfold: ['blindfold', 'eyes covered', 'повяз', 'завязанные глаза'],
    toys: ['sex toy', 'toys', 'vibrator', 'игрушк', 'вибратор'],
    roleplay: ['roleplay', 'role play', 'costume play', 'ролевая игра'],
    aftercare: ['aftercare', 'care after', 'забота после'],
    dirtytalk: ['dirty talk', 'dirty thoughts', 'грязн', 'пошлые мысли'],
    rough: ['rough sex', 'rough intimacy', 'hard sex', 'грубая близость'],
    gentle: ['gentle sex', 'soft sex', 'tender sex', 'нежный секс'],
    romantic: ['romantic intimacy', 'romantic sex', 'романтическая близость'],
    risk: ['risk', 'forbidden', 'taboo', 'опасн', 'запретн']
};

// 1. Сбор текста из всей карточки (как в рабочем примере)
function getCharacterCardText(character) {
    if (!character) return "";
    let chunks = [];
    const skipKey = /^(avatar|image|thumbnail|chat|date_last_chat|create_date)$/i;
    
    const walk = (value, key = '', depth = 0) => {
        if (depth > 5 || value == null || skipKey.test(key)) return;
        if (typeof value === 'string') {
            const t = value.trim();
            if (t && t.length < 50000) chunks.push(t);
            return;
        }
        if (typeof value !== 'object') return;
        if (Array.isArray(value)) {
            for (const v of value.slice(0, 120)) walk(v, key, depth + 1);
            return;
        }
        for (const [k, v] of Object.entries(value)) walk(v, k, depth + 1);
    };
    
    walk(character, 'character', 0);
    return chunks.join('\n').toLowerCase();
}

// 2. Умный поиск кинков
function extractKinks(character) {
    const text = getCharacterCardText(character);
    let foundKinks = [];

    // Ищем по словарю
    for (const [key, words] of Object.entries(KINK_KEYWORDS)) {
        if (words.some(w => text.includes(w))) {
            // Красивое название для вывода
            const displayName = key.charAt(0).toUpperCase() + key.slice(1);
            foundKinks.push(displayName);
        }
    }

    // Добавляем ручной ввод
    if (extension_settings[extensionName].manualKinks) {
        const manual = extension_settings[extensionName].manualKinks.split(/[,;\n]/);
        manual.forEach(p => {
            const cleaned = p.trim();
            if (cleaned.length > 2) foundKinks.push(cleaned);
        });
    }

    // Убираем дубликаты
    foundKinks = [...new Set(foundKinks)];

    if (foundKinks.length === 0) {
        foundKinks = ["Нажмите '🔍 Анализ' или введите кинки вручную."];
    }
    return foundKinks;
}

// 3. Создание интерфейса (ID-карта)
function createUI() {
    if (document.getElementById('lc-float-btn')) return;

    const uiHtml = `
        <div id="lc-float-btn" title="Love Clinic">🩺</div>
        <div id="lc-overlay"></div>
        <div id="lc-card">
            <div class="lc-header">
                <div class="lc-avatar-container">
                    <img id="lc-avatar" src="" alt="Avatar">
                </div>
                <div class="lc-header-info">
                    <h2 id="lc-char-name">Имя персонажа</h2>
                    <div class="lc-status">Медицинская карта пациента</div>
                </div>
            </div>
            
            <div class="lc-section">
                <div class="lc-section-title">🩺 Диагноз (Кинки):</div>
                <div class="lc-list" id="lc-list-container"></div>
            </div>

            <div class="lc-manual-input">
                <input type="text" id="lc-manual-kinks" placeholder="Ввести вручную (через запятую)...">
            </div>

            <div class="lc-buttons">
                <button id="lc-analyze-btn" style="background: #6a5acd;">🔍 Анализ</button>
                <button id="lc-roll-btn">🎲 Кубик</button>
                <button id="lc-close-btn" class="close-btn">Закрыть</button>
            </div>
        </div>
    `;
    $('body').append(uiHtml);

    // Логика перетаскивания (взято из HeartPulse)
    const btn = document.getElementById('lc-float-btn');
    let drag = null;

    btn.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button !== 0) return;
        const r = btn.getBoundingClientRect();
        drag = { id: e.pointerId, offX: e.clientX - r.left, offY: e.clientY - r.top, moved: false };
        btn.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    btn.addEventListener('pointermove', e => {
        if (!drag || drag.id !== e.pointerId) return;
        drag.moved = true;
        btn.style.left = (e.clientX - drag.offX) + 'px';
        btn.style.top = (e.clientY - drag.offY) + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
        e.preventDefault();
    });

    btn.addEventListener('pointerup', e => {
        if (!drag || drag.id !== e.pointerId) return;
        btn.releasePointerCapture(e.pointerId);
        if (!drag.moved) {
            openCard();
        } else {
            // Сохраняем позицию
            extension_settings[extensionName].x = parseInt(btn.style.left);
            extension_settings[extensionName].y = parseInt(btn.style.top);
            saveSettingsDebounced();
        }
        drag = null;
        e.preventDefault();
    });

    // Обработчики кнопок
    $('#lc-close-btn').on('click', closeCard);
    $('#lc-overlay').on('click', closeCard);
    
    $('#lc-analyze-btn').on('click', () => {
        const context = getContext();
        const character = context.characters[context.characterId];
        if (character) {
            currentKinks = extractKinks(character);
            updateListUI();
        }
    });

    $('#lc-roll-btn').on('click', () => {
        if (currentKinks.length > 0 && !currentKinks[0].includes("Нажмите")) {
            const randomKink = currentKinks[Math.floor(Math.random() * currentKinks.length)];
            // Отправляем в чат
            $('#send_textarea').val(`🎲 **Рулетка кинков:** Выпало: *${randomKink}*`);
            $('#send_but').click();
            
            // Подсвечиваем в списке
            $('.lc-item').css('background', 'transparent');
            $(`.lc-item:contains('${randomKink}')`).css('background', '#ffeb3b');
        }
    });

    // Сохранение ручного ввода
    $('#lc-manual-kinks').on('input', function() {
        extension_settings[extensionName].manualKinks = $(this).val();
        saveSettingsDebounced();
        const context = getContext();
        const character = context.characters[context.characterId];
        if (character) {
            currentKinks = extractKinks(character);
            updateListUI();
        }
    });
}

function updateListUI() {
    const container = $('#lc-list-container');
    container.empty();
    currentKinks.forEach(kink => {
        container.append(`<div class="lc-item">💊 ${kink}</div>`);
    });
}

function openCard() {
    const context = getContext();
    const character = context.characters[context.characterId];

    if (!character) {
        if (typeof toastr !== 'undefined') toastr.warning("Выберите персонажа в чате!");
        return;
    }

    // Аватар (с защитой от путей)
    const avatarUrl = character.avatar ? `/characters/${character.avatar}` : '';
    $('#lc-avatar').attr('src', avatarUrl).on('error', function() {
        $(this).attr('src', 'https://i.imgur.com/6M7Wp9D.png'); // Заглушка, если аватар не найден
    });

    $('#lc-char-name').text(character.name || 'Безымянный');
    $('#lc-manual-kinks').val(extension_settings[extensionName].manualKinks || '');

    currentKinks = extractKinks(character);
    updateListUI();

    $('#lc-overlay').fadeIn(200);
    $('#lc-card').fadeIn(200);
}

function closeCard() {
    $('#lc-overlay').fadeOut(200);
    $('#lc-card').fadeOut(200);
}

// 4. Инициализация и восстановление позиции кнопки
jQuery(async () => {
    setTimeout(() => {
        createUI();
        // Восстанавливаем позицию кнопки
        const btn = document.getElementById('lc-float-btn');
        if (btn && extension_settings[extensionName].x !== null) {
            btn.style.left = extension_settings[extensionName].x + 'px';
            btn.style.top = extension_settings[extensionName].y + 'px';
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';
        }
    }, 1000);

    eventSource.on(event_types.APP_READY, () => {
        const checkSettings = setInterval(() => {
            if ($('#extensions_settings').length > 0 && $('.love-clinic-settings').length === 0) {
                const settingsHtml = `
                <div class="love-clinic-settings">
                    <div class="inline-drawer">
                        <div class="inline-drawer-toggle inline-drawer-header">
                            <b>Love Clinic (Kink Reminder)</b>
                            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                        </div>
                        <div class="inline-drawer-content">
                            <button id="lc-open-settings-btn" class="menu_button">Открыть Медкарту</button>
                        </div>
                    </div>
                </div>`;
                $('#extensions_settings').append(settingsHtml);
                $('#lc-open-settings-btn').on('click', openCard);
                clearInterval(checkSettings);
            }
        }, 500);
    });
});
