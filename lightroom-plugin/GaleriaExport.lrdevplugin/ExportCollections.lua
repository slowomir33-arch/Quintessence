--[[
  Galeria Online Export Plugin
  Automatyczny eksport kolekcji do struktury light/max
  
  Użycie:
  1. Zaznacz Collection Set w Lightroom
  2. File > Plug-in Extras > Eksportuj albumy (Light + Max)
  3. Wybierz które albumy chcesz wyeksportować
  4. Skonfiguruj szablon nazewnictwa plików
  5. Wybierz folder docelowy
  6. Plugin wyeksportuje wybrane albumy z podziałem na light i max
  
  Tokeny nazewnictwa:
  {album}     - nazwa albumu/kolekcji
  {original}  - oryginalna nazwa pliku (bez rozszerzenia)
  {seq}       - numer sekwencyjny (001, 002, ...)
  {seq2}      - numer sekwencyjny 2-cyfrowy (01, 02, ...)
  {seq4}      - numer sekwencyjny 4-cyfrowy (0001, 0002, ...)
  {date}      - data zdjęcia (YYYY-MM-DD)
  {year}      - rok zdjęcia
  {month}     - miesiąc (01-12)
  {day}       - dzień (01-31)
  {hour}      - godzina (00-23)
  {minute}    - minuta (00-59)
]]

local LrApplication = import 'LrApplication'
local LrDialogs = import 'LrDialogs'
local LrFunctionContext = import 'LrFunctionContext'
local LrProgressScope = import 'LrProgressScope'
local LrTasks = import 'LrTasks'
local LrPathUtils = import 'LrPathUtils'
local LrFileUtils = import 'LrFileUtils'
local LrExportSession = import 'LrExportSession'
local LrView = import 'LrView'
local LrBinding = import 'LrBinding'
local LrColor = import 'LrColor'
local LrDate = import 'LrDate'
local LrStringUtils = import 'LrStringUtils'

-- ============================================
-- SZABLONY NAZEWNICTWA
-- ============================================

local NAMING_TEMPLATES = {
  { 
    name = "Album + Numer sekwencyjny",
    template = "{album}_{seq}",
    description = "Przykład: Urodziny Leny_001.jpg"
  },
  { 
    name = "Oryginalna nazwa",
    template = "{original}",
    description = "Przykład: DSC_1234.jpg"
  },
  { 
    name = "Album + Oryginalna nazwa",
    template = "{album}_{original}",
    description = "Przykład: Urodziny Leny_DSC_1234.jpg"
  },
  { 
    name = "Data + Numer",
    template = "{date}_{seq}",
    description = "Przykład: 2025-11-28_001.jpg"
  },
  { 
    name = "Album + Data + Numer",
    template = "{album}_{date}_{seq}",
    description = "Przykład: Urodziny Leny_2025-11-28_001.jpg"
  },
  { 
    name = "Rok-Miesiąc + Album + Numer",
    template = "{year}-{month}_{album}_{seq}",
    description = "Przykład: 2025-11_Urodziny Leny_001.jpg"
  },
  { 
    name = "Własny szablon",
    template = "",
    description = "Wprowadź własny szablon poniżej"
  },
}

-- ============================================
-- KONFIGURACJA EKSPORTU
-- ============================================

local EXPORT_SETTINGS = {
  -- Ustawienia dla wersji LIGHT (do internetu)
  light = {
    LR_export_destinationType = "specificFolder",
    LR_export_useSubfolder = false,
    LR_format = "JPEG",
    LR_jpeg_quality = 0.85,
    LR_size_doConstrain = true,
    LR_size_maxHeight = 1800,
    LR_size_maxWidth = 1800,
    LR_size_resizeType = "longEdge",
    LR_size_units = "pixels",
    LR_size_resolution = 72,
    LR_size_resolutionUnits = "inch",
    LR_outputSharpeningOn = true,
    LR_outputSharpeningMedia = "screen",
    LR_outputSharpeningLevel = 2,
    LR_minimizeEmbeddedMetadata = false,
    LR_removeLocationMetadata = false,
    LR_includeVideoFiles = false,
    LR_exportServiceProvider = "com.adobe.ag.export.file",
    LR_collisionHandling = "rename",
    LR_extensionCase = "lowercase",
    LR_initialSequenceNumber = 1,
    LR_renamingTokensOn = true,
  },
  
  -- Ustawienia dla wersji MAX (do druku)
  max = {
    LR_export_destinationType = "specificFolder",
    LR_export_useSubfolder = false,
    LR_format = "JPEG",
    LR_jpeg_quality = 1.0,
    LR_size_doConstrain = false,
    LR_size_resolution = 300,
    LR_size_resolutionUnits = "inch",
    LR_outputSharpeningOn = true,
    LR_outputSharpeningMedia = "glossy",
    LR_outputSharpeningLevel = 2,
    LR_minimizeEmbeddedMetadata = false,
    LR_removeLocationMetadata = false,
    LR_includeVideoFiles = false,
    LR_exportServiceProvider = "com.adobe.ag.export.file",
    LR_collisionHandling = "rename",
    LR_extensionCase = "lowercase",
    LR_initialSequenceNumber = 1,
    LR_renamingTokensOn = true,
  },
}

-- ============================================
-- FUNKCJE NAZEWNICTWA
-- ============================================

-- Generuje nazwę pliku na podstawie szablonu
local function generateFilename(template, albumName, originalFilename, sequenceNumber, captureDate)
  local result = template
  
  -- Parsuj datę (captureDate to timestamp lub nil)
  local year, month, day, hour, minute = "2025", "01", "01", "00", "00"
  if captureDate then
    local dateInfo = LrDate.timeToUserFormat(captureDate, "%Y-%m-%d-%H-%M")
    if dateInfo then
      year, month, day, hour, minute = dateInfo:match("(%d+)-(%d+)-(%d+)-(%d+)-(%d+)")
    end
  end
  
  -- Usuń rozszerzenie z oryginalnej nazwy
  local originalBase = LrPathUtils.removeExtension(originalFilename) or originalFilename
  
  -- Zamień tokeny
  result = result:gsub("{album}", albumName or "Album")
  result = result:gsub("{original}", originalBase or "photo")
  result = result:gsub("{seq4}", string.format("%04d", sequenceNumber or 1))
  result = result:gsub("{seq2}", string.format("%02d", sequenceNumber or 1))
  result = result:gsub("{seq}", string.format("%03d", sequenceNumber or 1))
  result = result:gsub("{date}", string.format("%s-%s-%s", year, month, day))
  result = result:gsub("{year}", year)
  result = result:gsub("{month}", month)
  result = result:gsub("{day}", day)
  result = result:gsub("{hour}", hour)
  result = result:gsub("{minute}", minute)
  
  -- Usuń niedozwolone znaki z nazwy pliku
  result = result:gsub('[<>:"/\\|?*]', '_')
  
  return result
end

-- Generuje podgląd dla przykładowych danych
local function generatePreview(template, albumName)
  -- Przykładowe dane do podglądu
  local exampleOriginal = "DSC_1234"
  local exampleSeq = 1
  local exampleDate = LrDate.currentTime()
  
  local filename = generateFilename(template, albumName, exampleOriginal, exampleSeq, exampleDate)
  return filename .. ".jpg"
end

-- ============================================
-- FUNKCJE POMOCNICZE
-- ============================================

-- Pobiera wszystkie kolekcje z Collection Set (rekurencyjnie)
local function getCollectionsFromSet(collectionSet)
  local collections = {}
  
  -- Pobierz bezpośrednie kolekcje
  local childCollections = collectionSet:getChildCollections()
  for _, collection in ipairs(childCollections) do
    table.insert(collections, collection)
  end
  
  -- Pobierz kolekcje z zagnieżdżonych setów
  local childSets = collectionSet:getChildCollectionSets()
  for _, childSet in ipairs(childSets) do
    local nestedCollections = getCollectionsFromSet(childSet)
    for _, collection in ipairs(nestedCollections) do
      table.insert(collections, collection)
    end
  end
  
  return collections
end

-- Tworzy folder jeśli nie istnieje
local function ensureFolder(folderPath)
  if not LrFileUtils.exists(folderPath) then
    LrFileUtils.createAllDirectories(folderPath)
  end
end

-- Eksportuje zdjęcia z kolekcji z własnym nazewnictwem
local function exportPhotosWithNaming(photos, exportSettings, destinationFolder, albumName, namingTemplate, progressScope, progressBase, progressTotal)
  local photoCount = #photos
  local exported = 0
  
  for i, photo in ipairs(photos) do
    -- Pobierz informacje o zdjęciu
    local originalFilename = photo:getFormattedMetadata('fileName')
    local captureDate = photo:getRawMetadata('captureTime')
    
    -- Wygeneruj nową nazwę
    local newFilename = generateFilename(namingTemplate, albumName, originalFilename, i, captureDate)
    
    -- Ustaw nazwę pliku w ustawieniach eksportu
    local photoSettings = {}
    for k, v in pairs(exportSettings) do
      photoSettings[k] = v
    end
    photoSettings.LR_export_destinationPathPrefix = destinationFolder
    photoSettings.LR_renamingTokensOn = true
    photoSettings.LR_tokens = "{{custom_token}}"
    photoSettings.LR_tokenCustomString = newFilename
    
    -- Eksportuj pojedyncze zdjęcie
    local exportSession = LrExportSession({
      photosToExport = { photo },
      exportSettings = photoSettings,
    })
    
    for _, rendition in exportSession:renditions() do
      local success, pathOrMessage = rendition:waitForRender()
      
      if success then
        -- Zmień nazwę pliku na docelową
        local exportedPath = pathOrMessage
        local extension = LrPathUtils.extension(exportedPath)
        local targetPath = LrPathUtils.child(destinationFolder, newFilename .. "." .. extension)
        
        -- Jeśli plik ma inną nazwę, zmień ją
        if exportedPath ~= targetPath then
          if LrFileUtils.exists(targetPath) then
            LrFileUtils.delete(targetPath)
          end
          LrFileUtils.move(exportedPath, targetPath)
        end
      end
    end
    
    exported = exported + 1
    
    if progressScope then
      local progress = progressBase + (exported / photoCount) * progressTotal
      progressScope:setPortionComplete(progress, 1)
    end
  end
  
  return exported
end

-- ============================================
-- DIALOG WYBORU ALBUMÓW (osobna funkcja)
-- ============================================

local function showSelectionDialog(allCollections)
  local selectedCollections = {}
  local selectedNamingTemplate = NAMING_TEMPLATES[1].template
  
  LrFunctionContext.callWithContext("selectionDialog", function(dialogContext)
    local props = LrBinding.makePropertyTable(dialogContext)
    
    -- Domyślnie zaznacz wszystkie albumy
    for i = 1, #allCollections do
      props["selected_" .. i] = true
    end
    props.selectAll = true
    
    -- Ustawienia nazewnictwa
    props.namingPreset = 1
    props.customTemplate = "{album}_{seq}"
    props.previewAlbumName = allCollections[1] and allCollections[1]:getName() or "Album"
    
    -- Funkcja aktualizacji podglądu
    local function updatePreview()
      local template
      if props.namingPreset == #NAMING_TEMPLATES then
        -- Własny szablon
        template = props.customTemplate
      else
        template = NAMING_TEMPLATES[props.namingPreset].template
      end
      props.filenamePreview = generatePreview(template, props.previewAlbumName)
    end
    
    -- Inicjalizuj podgląd
    updatePreview()
    
    -- Obserwatory dla aktualizacji podglądu
    props:addObserver("namingPreset", function()
      updatePreview()
    end)
    
    props:addObserver("customTemplate", function()
      if props.namingPreset == #NAMING_TEMPLATES then
        updatePreview()
      end
    end)
    
    local f = LrView.osFactory()
    
    -- ========== SEKCJA ALBUMÓW ==========
    local checkboxRows = {}
    
    table.insert(checkboxRows, f:row {
      f:checkbox {
        title = "Zaznacz / Odznacz wszystkie",
        value = LrView.bind("selectAll"),
        font = "<system/bold>",
      },
    })
    
    table.insert(checkboxRows, f:separator { fill_horizontal = 1 })
    
    for i, collection in ipairs(allCollections) do
      local photos = collection:getPhotos()
      local photoCount = #photos
      
      table.insert(checkboxRows, f:row {
        f:checkbox {
          title = string.format("%s (%d zdjęć)", collection:getName(), photoCount),
          value = LrView.bind("selected_" .. i),
          width = 380,
        },
      })
    end
    
    -- Observer dla "zaznacz wszystko"
    props:addObserver("selectAll", function(properties, key, newValue)
      for i = 1, #allCollections do
        properties["selected_" .. i] = newValue
      end
    end)
    
    -- ========== SEKCJA NAZEWNICTWA ==========
    local namingPresetItems = {}
    for i, preset in ipairs(NAMING_TEMPLATES) do
      table.insert(namingPresetItems, { title = preset.name, value = i })
    end
    
    -- ========== BUDOWA DIALOGU ==========
    local dialogContent = f:column {
      spacing = f:control_spacing(),
      bind_to_object = props,
      
      -- Nagłówek albumów
      f:static_text {
        title = "📁 Wybierz albumy do eksportu:",
        font = "<system/bold>",
      },
      
      f:scrolled_view {
        width = 500,
        height = 180,
        f:column(checkboxRows),
      },
      
      f:separator { fill_horizontal = 1 },
      
      -- Nagłówek nazewnictwa
      f:static_text {
        title = "📝 Nazewnictwo plików:",
        font = "<system/bold>",
      },
      
      f:row {
        f:static_text {
          title = "Szablon:",
          width = 80,
        },
        f:popup_menu {
          items = namingPresetItems,
          value = LrView.bind("namingPreset"),
          width = 250,
        },
      },
      
      -- Pole własnego szablonu (widoczne tylko gdy wybrany "Własny szablon")
      f:row {
        f:static_text {
          title = "Własny:",
          width = 80,
        },
        f:edit_field {
          value = LrView.bind("customTemplate"),
          width = 300,
          enabled = LrBinding.keyEquals("namingPreset", #NAMING_TEMPLATES),
        },
      },
      
      -- Dostępne tokeny
      f:row {
        f:static_text {
          title = "",
          width = 80,
        },
        f:static_text {
          title = "Tokeny: {album} {original} {seq} {seq2} {seq4} {date} {year} {month} {day}",
          text_color = LrColor(0.5, 0.5, 0.5),
          font = "<system/small>",
        },
      },
      
      f:separator { fill_horizontal = 1 },
      
      -- Podgląd na żywo
      f:row {
        f:static_text {
          title = "👁 Podgląd:",
          font = "<system/bold>",
          width = 80,
        },
        f:static_text {
          title = LrView.bind("filenamePreview"),
          font = "<system/bold>",
          text_color = LrColor(0.2, 0.6, 0.2),
          width = 350,
        },
      },
      
      -- Drugi przykład
      f:row {
        f:static_text {
          title = "",
          width = 80,
        },
        f:static_text {
          title = "(przykład dla pierwszego zdjęcia)",
          text_color = LrColor(0.5, 0.5, 0.5),
          font = "<system/small>",
        },
      },
      
      f:separator { fill_horizontal = 1 },
      
      -- Ustawienia eksportu
      f:static_text {
        title = "⚙️ Ustawienia eksportu:",
        font = "<system/bold>",
      },
      
      f:row {
        f:static_text {
          title = "• Light: 1800px, JPEG 85%, 72 DPI, wyostrzanie screen",
        },
      },
      
      f:row {
        f:static_text {
          title = "• Max: Oryginalny rozmiar, JPEG 100%, 300 DPI, wyostrzanie glossy",
        },
      },
    }
    
    local result = LrDialogs.presentModalDialog({
      title = "Galeria Online - Eksport albumów",
      contents = dialogContent,
      actionVerb = "Wybierz folder i eksportuj",
      cancelVerb = "Anuluj",
    })
    
    if result == "ok" then
      -- Pobierz wybrane albumy
      for i, collection in ipairs(allCollections) do
        if props["selected_" .. i] then
          table.insert(selectedCollections, collection)
        end
      end
      
      -- Pobierz wybrany szablon nazewnictwa
      if props.namingPreset == #NAMING_TEMPLATES then
        selectedNamingTemplate = props.customTemplate
      else
        selectedNamingTemplate = NAMING_TEMPLATES[props.namingPreset].template
      end
    end
  end)
  
  return selectedCollections, selectedNamingTemplate
end

-- ============================================
-- EKSPORT Z PASKIEM POSTĘPU (osobna funkcja)
-- ============================================

local function doExportWithProgress(selectedCollections, destinationFolder, namingTemplate)
  LrFunctionContext.callWithContext("exportProgress", function(context)
    local progressScope = LrProgressScope({
      title = "Eksport albumów do Galeria Online",
      functionContext = context,
    })
    
    local totalCollections = #selectedCollections
    local exportedPhotos = 0
    
    -- Eksportuj każdą kolekcję
    for collectionIndex, collection in ipairs(selectedCollections) do
      local collectionName = collection:getName()
      local photos = collection:getPhotos()
      
      if #photos > 0 then
        progressScope:setCaption(string.format(
          "Eksportowanie: %s (%d/%d)",
          collectionName,
          collectionIndex,
          totalCollections
        ))
        
        -- Utwórz foldery
        local albumFolder = LrPathUtils.child(destinationFolder, collectionName)
        local lightFolder = LrPathUtils.child(albumFolder, "light")
        local maxFolder = LrPathUtils.child(albumFolder, "max")
        
        ensureFolder(lightFolder)
        ensureFolder(maxFolder)
        
        -- Eksportuj wersję LIGHT
        progressScope:setCaption(string.format(
          "%s - Light (%d/%d)",
          collectionName,
          collectionIndex,
          totalCollections
        ))
        
        local baseProgress = (collectionIndex - 1) / totalCollections
        exportPhotosWithNaming(photos, EXPORT_SETTINGS.light, lightFolder, collectionName, namingTemplate, progressScope, baseProgress, 0.5 / totalCollections)
        
        -- Eksportuj wersję MAX
        progressScope:setCaption(string.format(
          "%s - Max (%d/%d)",
          collectionName,
          collectionIndex,
          totalCollections
        ))
        
        exportPhotosWithNaming(photos, EXPORT_SETTINGS.max, maxFolder, collectionName, namingTemplate, progressScope, baseProgress + 0.5 / totalCollections, 0.5 / totalCollections)
        
        exportedPhotos = exportedPhotos + #photos
      end
      
      -- Sprawdź czy użytkownik nie anulował
      if progressScope:isCanceled() then
        break
      end
    end
    
    progressScope:done()
    
    -- Pokaż podsumowanie
    if not progressScope:isCanceled() then
      LrDialogs.message(
        "Eksport zakończony!",
        string.format(
          "Wyeksportowano %d zdjęć z %d albumów.\n\nPliki zapisane w:\n%s\n\nStruktura:\n• [album]/light/ - do internetu\n• [album]/max/ - do druku\n\nSzablon nazw: %s",
          exportedPhotos * 2,
          totalCollections,
          destinationFolder,
          namingTemplate
        ),
        "info"
      )
      
      -- Otwórz folder w eksploratorze
      LrTasks.execute('start "" "' .. destinationFolder .. '"')
    end
  end)
end

-- ============================================
-- GŁÓWNA FUNKCJA EKSPORTU
-- ============================================

local function exportCollections()
  LrTasks.startAsyncTask(function()
    -- Pobierz aktywny katalog
    local catalog = LrApplication.activeCatalog()
    
    -- Pobierz zaznaczone źródła (kolekcje lub sety)
    local sources = catalog:getActiveSources()
    
    if #sources == 0 then
      LrDialogs.message("Błąd", "Najpierw zaznacz Collection Set lub kolekcję w panelu po lewej stronie.", "critical")
      return
    end
    
    -- Zbierz wszystkie kolekcje do eksportu
    local allCollections = {}
    
    for _, source in ipairs(sources) do
      if source:type() == "LrCollectionSet" then
        -- To jest Collection Set - pobierz wszystkie kolekcje
        local collections = getCollectionsFromSet(source)
        for _, collection in ipairs(collections) do
          table.insert(allCollections, collection)
        end
      elseif source:type() == "LrCollection" then
        -- To jest pojedyncza kolekcja
        table.insert(allCollections, source)
      end
    end
    
    if #allCollections == 0 then
      LrDialogs.message("Błąd", "Nie znaleziono żadnych kolekcji do eksportu.", "critical")
      return
    end
    
    -- Pokaż dialog wyboru (w osobnym kontekście)
    local selectedCollections, namingTemplate = showSelectionDialog(allCollections)
    
    -- Sprawdź czy coś wybrano
    if #selectedCollections == 0 then
      return
    end
    
    -- Wybierz folder docelowy
    local destinationFolder = LrDialogs.runOpenPanel({
      title = "Wybierz folder docelowy dla eksportu",
      canChooseFiles = false,
      canChooseDirectories = true,
      canCreateDirectories = true,
      allowsMultipleSelection = false,
    })
    
    if not destinationFolder or #destinationFolder == 0 then
      return
    end
    
    destinationFolder = destinationFolder[1]
    
    -- Wykonaj eksport z paskiem postępu (w osobnym kontekście)
    doExportWithProgress(selectedCollections, destinationFolder, namingTemplate)
  end)
end

-- Uruchom eksport
exportCollections()
