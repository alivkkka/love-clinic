// ПРАВИЛЬНЫЕ ИМПОРТЫ (как в рабочем расширении HeartPulse)
import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "love-clinic";
let currentKinks = [];

// 1. Функция поиска кинков в карте (исправленная и умная)
function extractKinks(character) {
    let text = "";
    // Собираем текст из всех полей карточки
    const fields = [character.description, character.personality, character.scenario, character.first_mes, character.mes_example];
    fields.forEach(field => {
        if (field) text += field + "\n";
    });

    // Ищем раздел с кинками (заголовок + содержимое)
    const kinkRegex = /(?:kinks?|fetishes?|turn-ons?|предпочтения|фетиши|кинки|извращения)\s*[:\-]\s*(.+)/gi;
    let matches;
    let kinks = [];

    while ((matches = kinkRegex.exec(text)) !== null) {
        const parts = matches[1].split(/[,;\n]/);
        parts.forEach(p => {
            // Убираем маркеры списка, лишние пробелы и кавычки
            const cleaned = p.trim().replace(/^[-*•\s"']+|["'\s]+$/g, '');
            if (cleaned.length > 2) kinks.push(cleaned);
        });
    }

    // Убираем дубликаты
    kinks = [...new Set(kinks)];

    if (kinks.length === 0) {
        kinks = ["Стандартные предпочтения (не найдены в карте)"];
    }
    return kinks;
}

// 2. Создание интерфейса с аватаром и именем
function createUI() {
    if (document.getElementById('lc-float-btn')) return;

    const uiHtml = `
        <div id="lc-float-btn" title="Love Clinic">🩺</div>
        <div id="lc-overlay"></div>
        <div id="lc-card">
            <div class="lc-header">
                <img id="lc-avatar" src="" alt="Avatar">
                <div class="lc-header-info">
                    <h2 id="lc-char-name">Имя персонажа</h2>
                    <p>Медицинская карта кинков</p>
                </div>
            </div>
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
        if (currentKinks.length > 0 && !currentKinks[0].includes("не найдены")) {
            const randomKink = currentKinks[Math.floor(Math.random() * currentKinks.length)];
            
            // Вставляем текст в поле ввода и отправляем
            $('#send_textarea').val(`🎲 **Рулетка кинков:** Выпало: *${randomKink}*`);
            $('#send_but').click();

            // Подсвечиваем в списке
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

    // Устанавливаем аватар и имя
    const avatarUrl = character.avatar ? `/characters/${character.avatar}` : '';
    $('#lc-avatar').attr('src', avatarUrl);
    $('#lc-char-name').text(character.name || 'Безымянный');

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

// 3. Инициализация (безопасная)
jQuery(async () => {
    // Создаём плавающую кнопку сразу при загрузке
    setTimeout(createUI, 1000);

    // Добавляем блок в настройки расширений (меню "Кубики")
    eventSource.on(event_types.APP_READY, () => {
        // Ждём, пока интерфейс настроек загрузится
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
                            <p>Вытаскивает фетиши из карты персонажа и позволяет выбрать случайный.</p>
                            <button id="lc-open-settings-btn" class="menu_button">Открыть Медкарту</button>
                        </div>
                    </div>
                </div>`;
                
                $('#extensions_settings').append(settingsHtml);
                $('#lc-open-settings-btn').on('click', openCard);
                clearInterval(checkSettings); // Останавливаем проверку, когда добавили
            }
        }, 500);
    });
});
