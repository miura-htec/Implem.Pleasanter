$p.hasPendingChanges = function () {
    if ($p.formChanged) {
        return true;
    }
    var state = $p.ex && $p.ex.ganttDirectManipulation;
    return !!(state
        && state.pendingChanges
        && Object.keys(state.pendingChanges).length > 0);
}

$p.confirmReload = function confirmReload() {
    if ($p.hasPendingChanges()) {
        return confirm($p.display('ConfirmUnload'));
    } else {
        return true;
    }
};
