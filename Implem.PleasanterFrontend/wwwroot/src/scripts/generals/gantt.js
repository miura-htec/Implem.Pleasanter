$p.moveGantt = function (type) {
    var $control = $('#GanttStartDate');
    var value = $('#Gantt' + type).val();
    $control.val(value);
    $control.attr('data-previous', value);
    $p.getData($control).GanttStartDate = value;
    $p.send($control);
}

$p.saveGanttChanges = function ($button) {
    var state = $p.ex.ganttDirectManipulation;
    var $targetButton = $button && $button.length === 1
        ? $button
        : $('#UpdateByGanttCommand');
    if (!state || $targetButton.length !== 1 || state.saving) {
        return;
    }

    state.saving = true;
    $p.updateGanttSaveButton();
    $p.clearData();

    var data = $p.getData($('.main-form'));
    var changeIds = Object.keys(state.pendingChanges);
    data.GanttChanges = JSON.stringify(changeIds.map(function (id) {
        return state.pendingChanges[id];
    }));

    var result = $p.syncSend($targetButton);
    state.saving = false;
    $p.updateGanttSaveButton();
}

$p.updateGanttSaveButton = function () {
    var $button = $('#UpdateByGanttCommand');
    if ($button.length !== 1) {
        return;
    }
    if ($button.hasClass('ui-button')) {
        $button.button('option', 'disabled', false);
    } else {
        $button.prop('disabled', false);
    }
}

$p.bindGanttDirectManipulation = function () {
    var $gantt = $('#Gantt');
    var state = $p.ex.ganttDirectManipulation;
    if ($gantt.length !== 1 || !state) {
        return;
    }

    var clientX = function (evt) {
        if (evt.touches && evt.touches.length > 0) {
            return evt.touches[0].clientX;
        }
        if (evt.changedTouches && evt.changedTouches.length > 0) {
            return evt.changedTouches[0].clientX;
        }
        return evt.clientX;
    };
    var dateDiffByDay = function (left, right) {
        return Math.round((left.getTime() - right.getTime()) / 86400000);
    };
    var cloneDate = function (date) {
        return new Date(date.getTime());
    };
    var formatDate = function (date) {
        return moment(date).format(state.formatUpper);
    };
    var earnedClass = function (task, width) {
        if (task.ProgressRate < 100
            && state.padding + state.xScale(task._startDate) + width * task.ProgressRate * 0.01 < state.now) {
            return 'delay';
        }
        if (task.ProgressRate === 100 && task.Completed) {
            return 'completed';
        }
        return '';
    };
    var titleClass = function (task, width) {
        if (task.ProgressRate < 100
            && state.padding + state.xScale(task._startDate) + width * task.ProgressRate * 0.01 < state.now
            && ($('#ShowGanttProgressRate').val() === '1' || !task.Completed)) {
            return 'delay';
        }
        return '';
    };
    var redrawTask = function (task) {
        var startX = state.padding + state.xScale(task._startDate);
        var completionX = state.padding + state.xScale(task._completionDate);
        var width = completionX - startX;
        d3.select('#Gantt .planned rect[data-id="' + task.Id + '"]')
            .attr('x', startX)
            .attr('width', width)
            .select('title')
            .text(task.StartTime + ' - ' + task.DisplayCompletionTime);
        d3.select('#Gantt .earned rect[data-id="' + task.Id + '"]')
            .attr('x', startX)
            .attr('width', width * task.ProgressRate * 0.01)
            .attr('class', earnedClass(task, width))
            .select('title')
            .text(task.StartTime + ' - ' + task.DisplayCompletionTime);
        d3.select('#Gantt .title text[data-id="' + task.Id + '"]')
            .attr('x', state.xScale(task._startDate) < 0
                ? state.padding + 5
                : state.padding + state.xScale(task._startDate) + 5)
            .attr('class', titleClass(task, width))
            .select('title')
            .text(task.StartTime + ' - ' + task.DisplayCompletionTime + ' : ' + task.Title);
        d3.select('#Gantt .gantt-resize-handle.left[data-id="' + task.Id + '"]')
            .attr('x', startX - state.handleWidth / 2);
        d3.select('#Gantt .gantt-resize-handle.right[data-id="' + task.Id + '"]')
            .attr('x', completionX - state.handleWidth / 2);
    };
    var setPendingChange = function (task) {
        var changed = task.StartTime !== task._originalStartTime
            || task.DisplayCompletionTime !== task._originalDisplayCompletionTime;
        if (changed) {
            state.pendingChanges[task.Id] = {
                Id: task.Id,
                StartTime: task.StartTime,
                CompletionTime: task.DisplayCompletionTime
            };
        } else {
            delete state.pendingChanges[task.Id];
        }
        $p.updateGanttSaveButton();
    };
    var endDrag = function () {
        if (!state.dragging) {
            return;
        }
        var dragging = state.dragging;
        state.dragging = null;
        $(document).off('.gantt-resize-drag');
        $('.gantt-resize-handle.active').removeClass('active');
        if (dragging.changed) {
            setPendingChange(dragging.task);
            $p.ex.ganttSuppressClickUntil = new Date().getTime() + 300;
        }
    };

    $gantt.off('.gantt-resize');
    $gantt.on('mousedown.gantt-resize touchstart.gantt-resize', '.gantt-resize-handle', function (event) {
        if (state.saving) {
            return;
        }
        var originalEvent = event.originalEvent || event;
        var isMouseEvent = originalEvent.type === 'mousedown';
        if (isMouseEvent && originalEvent.which !== 1) {
            return;
        }
        var $handle = $(this);
        var taskId = $handle.attr('data-id');
        var task = state.tasks[taskId];
        if (!task) {
            return;
        }
        var side = $handle.attr('data-side');
        if (side !== 'left' && side !== 'right') {
            return;
        }
        state.dragging = {
            side: side,
            task: task,
            startX: clientX(originalEvent),
            originalStart: cloneDate(task._startDate),
            originalCompletion: cloneDate(task._completionDate),
            originalDisplayCompletion: cloneDate(task._displayCompletionDate),
            movedDays: 0,
            changed: false
        };
        $handle.addClass('active');
        $(document).on('mousemove.gantt-resize-drag touchmove.gantt-resize-drag', function (moveEvent) {
            if (!state.dragging) {
                return;
            }
            var moveOriginal = moveEvent.originalEvent || moveEvent;
            var movedDays = Math.round((clientX(moveOriginal) - state.dragging.startX) / state.dayWidth);
            if (state.dragging.movedDays === movedDays) {
                return;
            }

            var dragTask = state.dragging.task;
            if (state.dragging.side === 'left') {
                var newStartDate = $p.dateAdd('d', movedDays, state.dragging.originalStart);
                if (newStartDate > state.dragging.originalCompletion) {
                    newStartDate = cloneDate(state.dragging.originalCompletion);
                }
                dragTask._startDate = newStartDate;
                dragTask._completionDate = cloneDate(state.dragging.originalCompletion);
                dragTask._displayCompletionDate = cloneDate(state.dragging.originalDisplayCompletion);
            } else {
                var newCompletionDate = $p.dateAdd('d', movedDays, state.dragging.originalCompletion);
                if (newCompletionDate < state.dragging.originalStart) {
                    newCompletionDate = cloneDate(state.dragging.originalStart);
                }
                var displayDiff = dateDiffByDay(newCompletionDate, state.dragging.originalCompletion);
                dragTask._startDate = cloneDate(state.dragging.originalStart);
                dragTask._completionDate = newCompletionDate;
                dragTask._displayCompletionDate = $p.dateAdd('d', displayDiff, state.dragging.originalDisplayCompletion);
            }

            dragTask.StartTime = formatDate(dragTask._startDate);
            dragTask.CompletionTime = formatDate(dragTask._completionDate);
            dragTask.DisplayCompletionTime = formatDate(dragTask._displayCompletionDate);
            redrawTask(dragTask);

            state.dragging.movedDays = movedDays;
            state.dragging.changed = movedDays !== 0;
            if (moveEvent.cancelable) {
                moveEvent.preventDefault();
            }
        });
        $(document).on('mouseup.gantt-resize-drag touchend.gantt-resize-drag touchcancel.gantt-resize-drag', endDrag);
    });
}

$p.drawGantt = function () {
    let spacing = 25;
    let heightPlaned = 23;
    let heightEarned = 23;
    let fontSize = 'inherit';
    let dYText = 16;
    let heightGantt = 45;
    let dYFirstLineAxis = 20;
    let dYSecondLineAxis = 40;
    let heightAxis = 20;
    if (window.matchMedia("(max-width: 1024px)").matches) {
        spacing = 50;
        heightPlaned = 40;
        heightEarned = 40;
        dYText = 29;
        heightGantt = 60;
        dYFirstLineAxis = 20;
        dYSecondLineAxis = 40;
        heightAxis = 20;
    }
    if (window.matchMedia("(max-width: 767px)").matches) {
        spacing = 30;
        heightPlaned = 23;
        heightEarned = 23;
        fontSize = '2.6vw';
        dYText = 16;
        heightGantt = 45;
        dYFirstLineAxis = 20;
        dYSecondLineAxis = 40;
        heightAxis = 20;
    }
    var $gantt = $('#Gantt');
    var $axis = $('#GanttAxis');
    if ($gantt.length !== 1) {
        return;
    }
    $gantt.empty();
    $axis.empty();
    var json = JSON.parse($('#GanttJson').val());
    if (json.length === 0) {
        $gantt.hide();
        return;
    }
    $gantt.show();
    var timeZoneOffset = $('#TimeZoneOffset').val();
    var justTime = new Date(moment().utcOffset(timeZoneOffset).format('YYYY/MM/DD HH:mm:ss'));
    var axis = d3.select('#GanttAxis');
    var svg = d3.select('#Gantt');
    var padding = 20;
    var width = parseInt(svg.style('width'));
    var format = $('#YmdFormat').val();
    var minDate = $p.transferedDate(format, $('#GanttMinDate').val());
    var maxDate = $p.transferedDate(format, $('#GanttMaxDate').val());
    var xScale = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([0, width - 60]);
    var dayWidth = xScale($p.dateAdd('d', 1, minDate)) - xScale(minDate);
    var formatUpper = format.toUpperCase();
    var months = [];
    var currentMonth;
    var days = [];
    for (var i = 0; i < $p.dateDiff('d', maxDate, minDate); i++) {
        var day = $p.dateAdd('d', i, minDate);
        days.push(day);
        if (currentMonth !== day.getMonth()) {
            currentMonth = day.getMonth();
            months.push(day);
        }
    }
    axis.append('g')
        .selectAll('rect')
        .data(days)
        .enter()
        .append('rect')
        .attr('x', function (d) { return 23 + xScale(d) })
        .attr('y', 25)
        .attr('width', xScale(days[1]))
        .attr('height', heightAxis)
        .attr('class', function (d) {
            switch (d.getDay()) {
                case 0: return 'sunday';
                case 6: return 'saturday';
                default: return 'weekday';
            }
        });
    var currentDate = minDate;
    while (currentDate <= maxDate) {
        var axisLine = [[30 + xScale(currentDate), 25], [30 + xScale(currentDate), 60]];
        var line = d3.line()
            .x(function (d) { return d[0] - 8; })
            .y(function (d) { return d[1]; });
        axis.append('g').attr('class', 'date').append('path').attr('d', line(axisLine));
        currentDate = $p.dateAdd('d', 1, currentDate);
    }
    axis.append('g')
        .attr('class', 'title')
        .selectAll('text')
        .data(months)
        .enter()
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('x', function (d) {
            return 22 + xScale(d) + (xScale($p.dateAdd('d', 1, d)) - xScale(d)) / 2;
        })
        .attr('y', dYFirstLineAxis)
        .style('font-size', fontSize)
        .text(function (d) {
            return d.getMonth() + 1;
        });
    axis.append('g')
        .attr('class', 'title')
        .selectAll('text')
        .data(days.filter(function (d) {
            return days.length <= 90 || [5, 10, 15, 20, 25, 30].indexOf(d.getDate()) > -1;
        }))
        .enter()
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('x', function (d) {
            return 22 + xScale(d) + (xScale($p.dateAdd('d', 1, d)) - xScale(d)) / 2;
        })
        .attr('y', dYSecondLineAxis)
        .style('font-size', fontSize)
        .text(function (d) {
            return d.getDate();
        });
    var now = padding + xScale(justTime);
    var groupCount = json.filter(function (d) { return d.GroupSummary }).length === 0
        ? 0
        : -1;
    $.each(json, function (index, task) {
        if (task.GroupSummary) {
            groupCount++;
        }
        task.Y = padding + index * spacing + groupCount * 25;
        if (!task.GroupSummary && task.Id > 0) {
            task._startDate = $p.transferedDate(format, task.StartTime);
            task._completionDate = $p.transferedDate(format, task.CompletionTime);
            task._displayCompletionDate = $p.transferedDate(format, task.DisplayCompletionTime);
            task._originalStartTime = task.StartTime;
            task._originalDisplayCompletionTime = task.DisplayCompletionTime;
        }
    });
    $p.ex.ganttDirectManipulation = {
        formatUpper: formatUpper,
        dayWidth: dayWidth,
        padding: padding,
        xScale: xScale,
        now: now,
        handleWidth: Math.max(8, Math.min(14, dayWidth)),
        tasks: json
            .filter(function (task) { return !task.GroupSummary && task.Id > 0; })
            .reduce(function (result, task) {
                result[task.Id] = task;
                return result;
            }, {}),
        pendingChanges: {},
        saving: false,
        dragging: null
    };
    $p.updateGanttSaveButton();
    $('#Gantt').css('height', d3.max(json, function (d) { return d.Y }) + heightGantt);
    svg.append('g')
        .selectAll('rect')
        .data(days.filter(function (d) {
            switch (d.getDay()) {
                case 0: return true;
                case 6: return true;
                default: return false;
            }
        }))
        .enter()
        .append('rect')
        .attr('x', function (d) { return padding + xScale(d) })
        .attr('y', padding - 10)
        .attr('width', xScale(days[1]))
        .attr('height', (padding + d3.max(json, function (d) { return d.Y })))
        .attr('class', function (d) {
            switch (d.getDay()) {
                case 0: return 'sunday';
                case 6: return 'saturday';
                default: return null;
            }
        });
    currentDate = minDate;
    while (currentDate <= maxDate) {
        draw(padding + xScale(currentDate), 'date');
        currentDate = $p.dateAdd('d', 1, currentDate);
    }
    svg.append('g').attr('class', 'planned')
        .selectAll('rect')
        .data(json)
        .enter()
        .append('rect')
        .attr('x', function (task) {
            return padding + xScale(task._startDate || $p.transferedDate(format, task.StartTime));
        })
        .attr('y', function (task) {
            return task.Y;
        })
        .attr('width', function (task) {
            return xScale(task._completionDate || $p.transferedDate(format, task.CompletionTime))
                - xScale(task._startDate || $p.transferedDate(format, task.StartTime));
        })
        .attr('height', heightPlaned)
        .attr('class', function (task) {
            var cls = task.Completed
                ? 'completed'
                : '';
            return task.GroupSummary
                ? cls + ' summary'
                : cls;
        })
        .attr('data-id', function (task) { return task.Id; })
        .append('title')
        .text(function (task) {
            return task.StartTime + ' - ' + task.DisplayCompletionTime;
        });
    svg.append('g').attr('class', 'earned')
        .selectAll('rect')
        .data(json)
        .enter()
        .append('rect')
        .attr('x', function (task) {
            return padding + xScale(task._startDate || $p.transferedDate(format, task.StartTime));
        })
        .attr('y', function (task) {
            return task.Y;
        })
        .attr('width', function (task) {
            return (xScale(task._completionDate || $p.transferedDate(format, task.CompletionTime))
                - xScale(task._startDate || $p.transferedDate(format, task.StartTime)))
                * task.ProgressRate * 0.01;
        })
        .attr('height', heightEarned)
        .attr('class', function (task) {
            var cls = task.ProgressRate < 100
                && (padding + xScale(task._startDate || $p.transferedDate(format, task.StartTime))
                    + ((xScale(task._completionDate || $p.transferedDate(format, task.CompletionTime))
                        - xScale(task._startDate || $p.transferedDate(format, task.StartTime)))
                        * task.ProgressRate * 0.01)) < now
                ? 'delay'
                : task.ProgressRate === 100 && task.Completed
                    ? 'completed'
                    : '';
            return task.GroupSummary
                ? cls + ' summary'
                : cls;
        })
        .attr('data-id', function (task) { return task.Id; })
        .append('title')
        .text(function (task) {
            return task.StartTime + ' - ' + task.DisplayCompletionTime;
        });
    var resizableTasks = json.filter(function (task) {
        return !task.GroupSummary && task.Id > 0;
    });
    svg.append('g').attr('class', 'gantt-resize')
        .selectAll('rect')
        .data(resizableTasks)
        .enter()
        .append('rect')
        .attr('class', 'gantt-resize-handle left')
        .attr('data-side', 'left')
        .attr('data-id', function (task) { return task.Id; })
        .attr('x', function (task) {
            return padding + xScale(task._startDate || $p.transferedDate(format, task.StartTime))
                - $p.ex.ganttDirectManipulation.handleWidth / 2;
        })
        .attr('y', function (task) {
            return task.Y;
        })
        .attr('width', $p.ex.ganttDirectManipulation.handleWidth)
        .attr('height', heightPlaned);
    svg.append('g').attr('class', 'gantt-resize')
        .selectAll('rect')
        .data(resizableTasks)
        .enter()
        .append('rect')
        .attr('class', 'gantt-resize-handle right')
        .attr('data-side', 'right')
        .attr('data-id', function (task) { return task.Id; })
        .attr('x', function (task) {
            return padding + xScale(task._completionDate || $p.transferedDate(format, task.CompletionTime))
                - $p.ex.ganttDirectManipulation.handleWidth / 2;
        })
        .attr('y', function (task) {
            return task.Y;
        })
        .attr('width', $p.ex.ganttDirectManipulation.handleWidth)
        .attr('height', heightPlaned);
    draw(now, 'now');
    svg.append('g').attr('class', 'title')
        .selectAll('text')
        .data(json)
        .enter()
        .append('text')
        .attr('x', function (task) {
            return xScale(task._startDate || $p.transferedDate(format, task.StartTime)) < 0
                ? padding + 5
                : padding + xScale(task._startDate || $p.transferedDate(format, task.StartTime)) + 5;
        })
        .attr('y', function (task) {
            return task.Y + dYText;
        })
        .attr('width', function (task) {
            return (xScale(task._completionDate || $p.transferedDate(format, task.CompletionTime))
                - xScale(task._startDate || $p.transferedDate(format, task.StartTime)))
                * task.ProgressRate * 0.01;
        })
        .attr('height', 50)
        .attr('class', function (task) {
            var cls = task.ProgressRate < 100
                && (padding + xScale(task._startDate || $p.transferedDate(format, task.StartTime))
                    + ((xScale(task._completionDate || $p.transferedDate(format, task.CompletionTime))
                        - xScale(task._startDate || $p.transferedDate(format, task.StartTime)))
                        * task.ProgressRate * 0.01)) < now
                && ($('#ShowGanttProgressRate').val() === '1' || !task.Completed)
                ? 'delay'
                : '';
            return task.GroupSummary
                ? cls + ' summary'
                : cls;
        })
        .attr('text-anchor', function () {
            return 'start';
        })
        .attr('data-id', function (task) { return task.Id; })
        .style('font-size', fontSize)
        .text(function (task) {
            if (window.matchMedia("(max-width: 1024px)").matches) {
                var span = (xScale(task._completionDate || $p.transferedDate(format, task.CompletionTime))
                    - xScale(task._startDate || $p.transferedDate(format, task.StartTime)))
                    * task.ProgressRate * 0.01;
                return task.Title.length * 7 > span
                    ? task.Title.substring(0, 50) + '...'
                    : task.Title;
            }
            return task.Title;
        })
        .append('title')
        .text(function (task) {
            return task.StartTime + ' - ' + task.DisplayCompletionTime + ' : ' + task.Title;
        });
    $p.bindGanttDirectManipulation();

    function draw(day, css) {
        var nowLineData = [
            [day, padding - 10],
            [day, (padding + d3.max(json, function (d) { return d.Y })) + 10]];
        var nowLine = d3.line()
            .x(function (d) { return d[0]; })
            .y(function (d) { return d[1]; });
        svg.append('g').attr('class', css).append('path').attr('d', nowLine(nowLineData));
    }
}
