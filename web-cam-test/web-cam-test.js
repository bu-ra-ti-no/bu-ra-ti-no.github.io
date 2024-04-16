
const video = document.getElementById('video');

(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 800, height: 450 } });

    const combo = document.getElementById('lst');
    const sources = await navigator.mediaDevices.enumerateDevices();
    for (const source of sources) {
      const option = document.createElement('option');
      option.value = JSON.stringify(source);
      option.label = source.label;
      option.disabled = source.kind !== 'videoinput';
      option.title = source.kind;
      combo.appendChild(option);
    }
    combo.dataset.selIndex = combo.selectedIndex;

    mediaControl.play(stream);
  } catch (err) {
    alert(err.message || err);
  }
})();

document.getElementById('lst').addEventListener('change', async (e) => {
  const combo = e.target;
  const source = JSON.parse(combo.selectedOptions[0].value);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: source.deviceId } } });
    mediaControl.play(stream);
    combo.dataset.selIndex = combo.selectedIndex;
  } catch (err) {
    alert(err.message || err);
    combo.selectedIndex = combo.dataset.selIndex;
  }
});

const mediaControl = {
  stop() {
    const stream = video.srcObject;
    if (!stream) return;

    for (const track of stream.getTracks()) {
      track.stop();
    }

    video.srcObject = null;
  },

  play(stream) {
    if (video.srcObject) this.stop();
    if (!stream) return;

    video.srcObject = stream;
    video.play();
  }
};
