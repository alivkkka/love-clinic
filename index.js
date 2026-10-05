// ИСПРАВЛЕННЫЕ ИМПОРТЫ (теперь они правильные)
import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "love-clinic";
let currentKinks = [];

// 1. Функция поиска кинков в карте
function extractKinks(character) {
    let text = "";
    if (character.description) text += character.description + "\n";
    if (character.personality) text += character.personality + "\n";
    if (character.scenario) text += character.scenario + "\n";
    if (character.first_mes) text += character.first_mes + "\n";

    const kinkRegex = /(?:kinks?|fetishes?|turn-ons?|предпочтения|фетиши|кинки|извращения)\s*[:\-]\s*(.+)/gi;
    let matches;
    let kinks = [];

    while ((matches = kinkRegex.exec(text)) !== null) {
        const parts = matches[1].split(/[,;\n]/);
        parts.forEach(p => {
            const cleaned = p.trim().replace(/^[-*•\s]+/, '');
            if (cleaned.length > 2) kinks.push(cleaned);
        });
    }

    kinks = [...new Set(kinks)];

    if (kinks.length === 0) {
        kinks = ["Стандартные предпочтения (не найдены в карте)"];
    }
    return kinks;
}

// 2. Создание интерфейса
function createUI() {
    if (document.getElementById('lc-float-btn')) return; // Уже создано

    const uiHtml = `
        <div id="lc-float-btn" title="Love Clinic">🩺</div>
        <div id="lc-overlay"></div>
        <div id="lc-card">
            <h2>🩺 Медицинская карта кинков</h2>
            <div class="lc-list" id="lc-list-container"></div>
            <div class="lc-buttons">
                <button id="lc-roll-btn">🎲 Бросить кубик</button>
                <button id="lc-close-btn" class="close-btn">Закрыть</button>
            </div>
        </div>
    `;
    $('body').append(uiHtml);

    $('#lc-float-btn').on('click', openCard);
    $('#lc-close-btn').on('click', closeCard);
    $('#lc-overlay').on('click', closeCard);
    
    $('#lc-roll-btn').on('click', () => {
        if (currentKinks.length > 0 && currentKinks[0] !== "Стандартные предпочтения (не найдены в карте)") {
            const randomKink = currentKinks[Math.floor(Math.random() * currentKinks.length)];
            
            // Вставляем текст в поле ввода и отправляем
            $('#send_textarea').val(`🎲 **Рулетка кинков:** Выпало: *${randomKink}*`);
            $('#send_but').click();

            $('.lc-item').css('background', 'transparent');
            $(`.lc-item:contains('${randomKink}')`).css('background', '#ffeb3b');
        }
    });
}

function openCard() {
    const context = getContext();
    const character = context.characters[context.characterId];

    if (!character) {
        if (typeof toastr !== 'undefined') toastr.warning("Сначала выберите персонажа в чате!");
        return;
    }

    currentKinks = extractKinks(character);
    
    const container = $('#lc-list-container');
    container.empty();
    
    currentKinks.forEach(kink => {
        container.append(`<div class="lc-item">💊 ${kink}</div>`);
    });

    $('#lc-overlay').fadeIn(200);
    $('#lc-card').fadeIn(200);
}

function closeCard() {
    $('#lc-overlay').fadeOut(200);
    $('#lc-card').fadeOut(200);
}

// 3. Инициализация (БЕЗОПАСНАЯ)
jQuery(async () => {
    // Пытаемся создать кнопку сразу при загрузке
    setTimeout(createUI, 1000);

    // Пытаемся добавить блок в настройки
    const addSettingsBlock = () => {
        if ($('#extensions_settings').length > 0 && $('.love-clinic-settings').length === 0) {
            const settingsHtml = `
            <div class="love-clinic-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Love Clinic (Kink Reminder)</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <p>Вытаскивает фетиши из карты персонажа и позволяет выбрать случайный.</p>
                        <button id="lc-open-settings-btn" class="menu_button">Открыть Медкарту</button>
                    </div>
                </div>
            </div>`;
            
            $('#extensions_settings').append(settingsHtml);
            $('#lc-open-settings-btn').on('click', openCard);
        }
    };

    // Пытаемся добавить блок каждую секунду в течение 10 секунд (на случай, если Таверна грузится медленно)
    let attempts = 0;
    const interval = setInterval(() => {
        addSettingsBlock();
        attempts++;
        if (attempts > 10) clearInterval(interval);
    }, 1000);
});
