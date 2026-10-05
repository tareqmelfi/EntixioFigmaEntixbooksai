const button = document.getElementById('copy-url');
button.addEventListener('click', async () => {
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(document.getElementById('mcp-url').textContent);
    status.textContent = 'تم نسخ العنوان';
  } catch {
    status.textContent = 'تعذر النسخ تلقائيًا. حدد العنوان الظاهر وانسخه يدويًا.';
  }
});
