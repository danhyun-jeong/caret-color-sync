# Caret Color Sync

Caret Color Sync is a plugin designed to automatically change the caret (cursor) color based on your current input source. It’s especially helpful for multilingual users who switch between different input methods. **Currently, this plugin only supports macOS**; it will not function on other operating systems.

## Installation & Setup

Since Obsidian plugins cannot directly detect the system input source, you need to use [Hammerspoon](https://www.hammerspoon.org/) alongside the plugin:

1. Install Hammerspoon from the [official website](https://www.hammerspoon.org/).
2. Open your Hammerspoon configuration by clicking the Hammerspoon menu bar icon and selecting “Open Config”.
3. Paste the following into your `init.lua`:

    ```lua
    -- Function to write the current input source status to a file
    local function writeInputSourceStatus()
        local sourceID = hs.keycodes.currentSourceID()

        -- Remove known prefixes and convert dots to hyphens
        local trimmed = sourceID
          :gsub("^com%.apple%.inputmethod%.", "")
          :gsub("^com%.apple%.keylayout%.", "")
        trimmed = trimmed:gsub("%.", "-")

        -- Write the transformed status to the output file
        local filePath = os.getenv("HOME") .. "/.current_input_source_status"
        local file = io.open(filePath, "w")
        if file then
            file:write(trimmed)
            file:close()
            hs.console.printStyledtext("Input Source status written: " .. trimmed)
        else
            hs.console.printStyledtext("Failed to write to file: " .. filePath)
        end
    end

    -- Delayed write helper function
    local function delayedWrite()
        hs.timer.doAfter(0.1, writeInputSourceStatus)
    end

    -- Initial write on startup
    writeInputSourceStatus()

    -- Create an event tap to detect key presses for input source changes
    myEventTap = hs.eventtap.new({
        hs.eventtap.event.types.keyDown,
        hs.eventtap.event.types.keyUp
    }, function(e)
        local keyCode = e:getKeyCode()
        local mods = e:getFlags()

        -- Caps Lock or F19
        if keyCode == 57 or keyCode == 80 then
            delayedWrite()
        end

        -- Control + Spacebar
        if keyCode == 49 and mods["ctrl"] then
            delayedWrite()
        end

        -- Control + Option + Spacebar
        if keyCode == 49 and mods["ctrl"] and mods["alt"] then
            delayedWrite()
        end

        return false
    end)
    myEventTap:start()
    -- Start the event tap to listen for key events
    ```

4. In the Hammerspoon console, switch your input source and confirm you see “Input Source status written: `<status>`” messages. Copy the `<status>` text and paste it into the **Input Source Name** field in the plugin’s Settings tab.
5. Finally, choose your desired caret color for each input source. That’s all!

## Notes

Because Obsidian cannot hook directly into system input events, Hammerspoon detects input source changes by listening for specific key events (Caps Lock, F19, Control+Space, Control+Option+Space).  
If you use custom shortcuts to change input sources, you’ll need to update the Hammerspoon `init.lua` to trigger `writeInputSourceStatus()` for those keys as well.  