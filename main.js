const { Plugin, PluginSettingTab, Setting } = require("obsidian");
const fs = require("fs");
const path = require("path");

const DEFAULT_SETTINGS = { inputSources: [], pollingInterval: 500 }; // each entry: {input_source_name, color, useAccent}

// Store the last applied input source status to detect changes
let lastStatus = null;

module.exports = class CaretColorSyncPlugin extends Plugin {
  // Persisted plugin settings
  settings = DEFAULT_SETTINGS;

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  // Build dynamic CSS rules for each configured input source, adjusting caret and cursor colors
  // Generate CSS based on settings
  generateCSS() {
    let css = '';
    this.settings.inputSources.forEach(entry => {
      const cls = entry.input_source_name;
      const color = entry.useAccent ? 'var(--color-accent-1)' : entry.color;
      css += `.cm-content.${cls} { caret-color: ${color} !important; }\n`;
      css += `.cm-cursorLayer.${cls} .cm-cursor-primary { border-left-color: ${color} !important; }\n`;
    });
    return css;
  }

  async onload() {
    console.log("CaretColorSync plugin loaded");

    // Load settings
    await this.loadSettings();

    // add settings tab
    this.addSettingTab(new InputSourceSettingTab(this.app, this));

    // Inject CSS based on settings
    this.styleEl = document.createElement("style");
    this.styleEl.id = "caret-color-sync-styles";
    this.styleEl.textContent = this.generateCSS();
    document.head.appendChild(this.styleEl);

    // Inject UI grouping styles
    this.uiStyleEl = document.createElement('style');
    this.uiStyleEl.id = 'caret-color-sync-ui-styles';
    this.uiStyleEl.textContent = `
      .vertical-tab-content h1 {
        margin-bottom: 1.2em;
      }
      .input-source-group {
        border-bottom: 1px solid var(--divider-color);
        padding-bottom: 0.2em;
        margin-top:0.8em;
        margin-bottom: 0.8em;
      }
      .input-source-group .setting-item {
        border-top: none !important;
      }
      .input-source-group .setting-item-name {
        font-size: 1em;
      }
      .input-source-group .setting-item:nth-child(1) .setting-item-name {
        font-size: 1.25em;
        font-weight: bold;
      }
    `;
    document.head.appendChild(this.uiStyleEl);

    // 2) Read the input source status file and toggle CSS classes on editor and cursor layer
    const pollInputSourceStatus = () => {
      const filePath = path.join(
        process.env.HOME || process.env.USERPROFILE,
        ".current_input_source_status"
      );
      let status;
      try {
        status = fs.readFileSync(filePath, "utf8").trim();
      } catch (err) {
        console.warn("CaretColorSync: Failed to read Input Source status file", err);
        return;
      }

      // If the status hasn’t changed since last check, skip updating
      if (status === lastStatus) return;
      const prev = lastStatus;
      lastStatus = status;

      const editors = document.querySelectorAll(".cm-content");
      editors.forEach((editor) => {
        // Update CSS classes on the main editor content element
        if (prev) editor.classList.remove(prev);
        editor.classList.add(status);

        // Update CSS classes on the cursor layer element
        const root = editor.closest(".cm-editor");
        if (root) {
          const layer = root.querySelector(".cm-cursorLayer");
          if (layer) {
            if (prev) layer.classList.remove(prev);
            layer.classList.add(status);
          }
        }
      });
    };
    this.pollInputSourceStatus = pollInputSourceStatus;

    // 3) Poll the input source status at the configured interval
    this.interval = setInterval(this.pollInputSourceStatus, this.settings.pollingInterval);
    setTimeout(pollInputSourceStatus, 1000);
  }

  onunload() {
    clearInterval(this.interval);
    // Remove dynamically injected <style> elements on plugin unload
    if (this.styleEl && this.styleEl.parentNode) {
      this.styleEl.parentNode.removeChild(this.styleEl);
    }
    if (this.uiStyleEl && this.uiStyleEl.parentNode) {
      this.uiStyleEl.parentNode.removeChild(this.uiStyleEl);
    }
    console.log("CaretColorSync plugin unloaded");
  }
};

class InputSourceSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h1', { text: 'Set Caret Color Based on Input Source' });

    this.plugin.settings.inputSources.forEach((entry, index) => {
      // Create a group container for this source
      const group = containerEl.createDiv({ cls: 'input-source-group' });

      // 1) Header row with title and delete button
      new Setting(group)
        .setName(`Input Source ${index + 1}`)
        .addExtraButton(btn => {
          btn.setIcon('trash')
             .setTooltip('Remove this input source')
             .onClick(async () => {
               this.plugin.settings.inputSources.splice(index, 1);
               await this.plugin.saveSettings();
               this.display();
             });
        });

      // Input Source Name text field
      new Setting(group)
        .setName('Input Source Name')
        .addText(text => {
          text.inputEl.placeholder = 'Get this from Hammerspoon console log';
          text.inputEl.style.width = '200px'
          text.setValue(entry.input_source_name || '')
            .onChange(async (value) => {
              entry.input_source_name = value;
              await this.plugin.saveSettings();
              this.plugin.styleEl.textContent = this.plugin.generateCSS();
            });
        });

      // 4) Color picker
      const colorSetting = new Setting(group)
        .setName('Color')
        .addText(text => {
          text.setPlaceholder('#rrggbb')
            .setValue(entry.color || '')
            .onChange(async (value) => {
              entry.color = value;
              await this.plugin.saveSettings();
              this.plugin.styleEl.textContent = this.plugin.generateCSS();
            });
          text.inputEl.type = 'color';
        });

      if (entry.useAccent) {
        colorSetting.settingEl.style.display = 'none';
      }

      // 5) Use Accent Color toggle
      const toggleSetting = new Setting(group)
        .setName('Use Accent Color')
        .addToggle(toggle => {
          toggle.setValue(entry.useAccent || false)
            .onChange(async (use) => {
              entry.useAccent = use;
              await this.plugin.saveSettings();
              this.plugin.styleEl.textContent = this.plugin.generateCSS();
              colorSetting.settingEl.style.display = use ? 'none' : '';
            });
        });
      
    });

    // Button to add new input source
    new Setting(containerEl)
      .addButton(btn => {
        btn.setButtonText('Add Input Source')
          .setCta()
          .onClick(async () => {
            this.plugin.settings.inputSources.push({
              input_source_name: '',
              color: '#000000',
              useAccent: false
            });
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // Polling Rate slider
    containerEl.createEl('h1', { text: 'Set Polling Interval' });
    const rateSetting = new Setting(containerEl)
      .setName(`The shorter the polling interval, the more immediately the caret color will update when the input source changes, but this also increases system load. Current polling interval: ${this.plugin.settings.pollingInterval} ms`)
      .addSlider(slider => {
        slider
          .setLimits(250, 1000, 50)
          .setValue(this.plugin.settings.pollingInterval)
          .setDynamicTooltip()
          .onChange(async (value) => {
            // Update setting
            this.plugin.settings.pollingInterval = value;
            await this.plugin.saveSettings();
            // Update label
            rateSetting.setName(
              `The shorter the polling interval, the more immediately the caret color will update when the input source changes, ` +
              `but this also increases system load. Current polling interval: ${value} ms`
            );
            // Refresh tooltip
            slider.setDynamicTooltip();
            // Restart polling interval
            clearInterval(this.plugin.interval);
            this.plugin.interval = setInterval(
              this.plugin.pollInputSourceStatus,
              this.plugin.settings.pollingInterval
            );
          });
      });
  }
}