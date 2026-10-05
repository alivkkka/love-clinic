import { getContext, extension_settings } from "../../../extensions.js";
import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";

const extensionName = "love-clinic";
let currentKinks = [];

// Инициализация настроек
if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = { manualKinks: "" };
}

// 1. Парсер кинков (ищет по заголовкам и добавляет ручные)
function extractKinks(character) {
    let text = "";
    const fields = [character.description, character.personality, character.scenario, character.first_mes, character.mes_example];
    fields.forEach(field => { if (field) text += field + "\n"; });

    const kinkRegex = /(?:kinks?|fetishes?|turn-ons?|предпочтения|фетиши|кинки|извращения)\s*[:\-]\s*(.+)/gi;
    let matches;
    let kinks = [];

    while ((matches = kinkRegex.exec(text)) !== null) {
        const parts = matches[1].split(/[,;\n]/);
        parts.forEach(p => {
            const cleaned = p.trim().replace(/^[-*•\s"']+|["'\s]+$/g, '');
            if (cleaned.length > 2) kinks.push(cleaned);
        });
    }

    // Добавляем ручной ввод
    if (extension_settings[extensionName].manualKinks) {
        const manual = extension_settings[extensionName].manualKinks.split(/[,;\n]/);
        manual.forEach(p => {
            const cleaned = p.trim().replace(/^[-*•\s"']+|["'\s]+$/g, '');
            if (cleaned.length > 2) kinks.push(cleaned);
        });
    }

    kinks = [...new Set(kinks)]; // Удаляем дубликаты
    if (kinks.length === 0) {
        kinks = ["Нажмите '🔍 Анализ' или введите кинки вручную."];
    }
    return kinks;
}

// 2. Создание интерфейса
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
                <div class="lc-section-title">Диагноз (Кинки):</div>
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

    // Логика перетаскивания кнопки (из рабочего примера)
    const $btn = $('#lc-float-btn');
    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    $btn.on('pointerdown', function(e) {
        if(e.button !== undefined && e.button !== 0) return;
        isDragging = false;
        const r = $btn[0].getBoundingClientRect();
        dragOffsetX = e.clientX - r.left;
        dragOffsetY = e.clientY - r.top;
        $btn[0].setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    $btn.on('pointermove', function(e) {
        if (!e.buttons) return;
        isDragging = true;
        $btn.css({
            left: (e.clientX - dragOffsetX) + 'px',
            top: (e.clientY - dragOffsetY) + 'px',
            right: 'auto',
            bottom: 'auto'
        });
        e.preventDefault();
    });

    $btn.on('pointerup', function(e) {
        $btn[0].releasePointerCapture(e.pointerId);
        if (!isDragging) {
            openCard();
        }
        isDragging = false;
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
            $('#send_textarea').val(`🎲 **Рулетка кинков:** Выпало: *${randomKink}*`);
            $('#send_but').click();
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

    const avatarUrl = character.avatar ? `/characters/${character.avatar}` : '';
    $('#lc-avatar').attr('src', avatarUrl);
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

// 3. Инициализация
jQuery(async () => {
    setTimeout(createUI, 1000);
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
