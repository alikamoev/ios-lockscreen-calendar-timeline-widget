async function createWidget() {
    // Создаем виджет
    let widget = new ListWidget();

    // Устанавливаем размеры для рисования
    let width = 172; // Ширина виджета
    let height = 76; // Высота виджета
    let lineThickness = 0.69; // Толщина линий времени
    let currentTimeLineThickness = 1; // Толщина линии текущего времени
    let lineHeight = 50; // Высота линий
    let verticalPadding = 7; // Вертикальные отступы от верхней границы до линий
    let bottomPadding = 4; // Отступ от нижней границы линий до текста
    let circleRadius = 3.5; // Радиус круга

    let drawContext = new DrawContext();
    drawContext.size = new Size(width, height);
    drawContext.opaque = false;
    drawContext.respectScreenScale = true;

    let currentDate = new Date();
    let currentHour24 = currentDate.getHours();
    let currentMinute = currentDate.getMinutes();
    let currentTotalMinutes = currentHour24 * 60 + currentMinute;

    let padding = width / 10.5;
    let usableWidth = width - 2 * padding;
    let spacing = usableWidth / 3;

    // Загрузка событий за три дня: вчера, сегодня и завтра
    let events = await Promise.all([
        CalendarEvent.between(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1),
                              new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())),
        CalendarEvent.between(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
                              new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)),
        CalendarEvent.between(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1),
                              new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 2))
    ]).then(results => results.flat().filter(event => !event.isAllDay));

    // Удаление дубликатов
    let uniqueEvents = events.reduce((acc, current) => {
        let duplicate = acc.find(event => event.title === current.title && event.startDate.getTime() === current.startDate.getTime() && event.endDate.getTime() === current.endDate.getTime());
        if (!duplicate) {
            acc.push(current);
        }
        return acc;
    }, []);

    let levels = [];
    let lastUsedIndex = -1;

    function findLevel(start, end) {
        let maxLevels = 3;
        for (let i = 0; i < maxLevels; i++) {
            let levelIndex = (lastUsedIndex + 1 + i) % maxLevels;
            if (!levels[levelIndex] || !levels[levelIndex].some(e => start < e.end && end > e.start)) {
                lastUsedIndex = levelIndex;
                return levelIndex;
            }
        }
        return 0;
    }

    uniqueEvents.forEach(event => {
        let startDateTime = new Date(event.startDate);
        let endDateTime = new Date(event.endDate);
        let startHour = startDateTime.getHours() + startDateTime.getMinutes() / 60 + (startDateTime.getDate() - currentDate.getDate()) * 24;
        let endHour = endDateTime.getHours() + endDateTime.getMinutes() / 60 + (endDateTime.getDate() - currentDate.getDate()) * 24;
        let level = findLevel(startHour, endHour);
        if (!levels[level]) levels[level] = [];
        levels[level].push({ start: startHour, end: endHour, event });
    });

    for (let i = 0; i < 4; i++) {
        let hour = (currentHour24 + i) % 24;
        let displayHour = hour % 12 || 12;
        let suffix = hour >= 12 && hour < 24 ? "pm" : "am";
        let x = padding + i * spacing + lineThickness / 2;

        drawContext.setFillColor(new Color("#FFFFFF", 0.65));
        drawContext.fillRect(new Rect(x - lineThickness / 2, verticalPadding, lineThickness, lineHeight));

        drawContext.setTextColor(new Color("#FFFFFF"));
        drawContext.setFont(Font.systemFont(13));
        let hourText = `${displayHour}${suffix}`;
        let textWidth = hourText.length * 8;
        let textX = x - (textWidth / 2);
        let textY = verticalPadding + lineHeight + bottomPadding;
        drawContext.drawText(hourText, new Point(textX, textY));
    }

    let currentTimeLineX = padding + ((currentHour24 + currentMinute / 60) - currentHour24) * spacing;
    drawContext.setFillColor(new Color("#FFFFFF", 1));
    drawContext.fillRect(new Rect(currentTimeLineX, verticalPadding, currentTimeLineThickness, lineHeight));

    let circleCenterX = currentTimeLineX + currentTimeLineThickness / 2 - circleRadius;
    let circleCenterY = verticalPadding - circleRadius - 3 + 2;
    drawContext.fillEllipse(new Rect(circleCenterX, circleCenterY, circleRadius * 2, circleRadius * 2));

    levels.forEach((level, idx) => {
        level.forEach(({ start, end, event }) => {
            let startX = padding + ((start - currentHour24) * spacing);
            let endX = padding + ((end - currentHour24) * spacing);
            let eventWidth = endX - startX;
            let eventHeight = lineHeight * 0.2;
            let eventY = verticalPadding + lineHeight * (0.18 + idx * 0.22);

            let cornerRadius = eventHeight / 2;
            let opacity = (event.startDate <= currentDate && event.endDate >= currentDate) || event.endDate <= currentDate ? 0.23 : 0.65;
            let eventRect = new Path();
            eventRect.addRoundedRect(new Rect(startX, eventY, eventWidth, eventHeight), cornerRadius, cornerRadius);
            drawContext.setFillColor(new Color("#FFFFFF", opacity));
            drawContext.addPath(eventRect);
            drawContext.fillPath();
        });
    });

    let image = drawContext.getImage();

    let imageElement = widget.addImage(image);
    imageElement.centerAlignImage();

    widget.presentMedium();

    let nextRefresh = new Date();
    nextRefresh.setMinutes(currentDate.getMinutes() + 3);
    nextRefresh.setSeconds(0);
    widget.refreshAfterDate = nextRefresh;

    Script.setWidget(widget);
    Script.complete();
}

createWidget();
