$(function () {
    $(document).on(
        'click',
        '#Gantt .planned rect,#Gantt .earned rect,#Gantt .title text',
        function () {
            if (($p.ex.ganttSuppressClickUntil || 0) > new Date().getTime()) {
                return;
            }
            if ($(this).filter('.summary').length === 0) {
                $p.transition($('#BaseUrl').val() + $(this).attr('data-id'));
            }
        }
    );
});
