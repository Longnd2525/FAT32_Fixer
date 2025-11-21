import React, { useState } from "react";
import {
  AlertCircle,
  HardDrive,
  CheckCircle,
  XCircle,
  Download,
  Search,
  AlertTriangle,
} from "lucide-react";

const FAT32PartitionTool = () => {
  const [diskImage, setDiskImage] = useState<Uint8Array | null>(null);
  const [mbrData, setMbrData] = useState<Uint8Array | null>(null);
  const [hasBackup, setHasBackup] = useState<boolean>(false);
  const [backupMbr, setBackupMbr] = useState<Uint8Array | null>(null);
  type PartitionInfo = {
    bootable: boolean;
    partitionType: number;
    lbaStart: number;
    numSectors: number;
    sizeInMB: number;
  } | null;
  const [partitionInfo, setPartitionInfo] = useState<PartitionInfo>(null);
  type BootSectorInfo = {
    sector: number;
    oem: string;
    type: string;
    totalSectors: number;
    sectorsPerCluster: number;
    bytesPerSector: number;
  };

  const [bootSectors, setBootSectors] = useState<BootSectorInfo[]>([]);
  const [externalFileName, setExternalFileName] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string>("none");
  const [log, setLog] = useState<
    Array<{ message: string; type: string; time: string }>
  >([]);

  const addLog = (message: string, type: string = "info") => {
    setLog((prev) => [
      ...prev,
      { message, type, time: new Date().toLocaleTimeString() },
    ]);
  };

  // Compute an appropriate export filename. If the user loaded a file, preserve its name/extension.
  const getExportFileName = () => {
    if (externalFileName) {
      return externalFileName;
    }
    // default filename
    return "fat32_disk.img";
  };

  const createVirtualDisk = (withBackup: boolean) => {
    const diskSize = 32 * 1024 * 1024;
    const disk = new Uint8Array(diskSize);

    // Tạo MBR
    const mbr = new Uint8Array(512);

    for (let i = 0; i < 446; i++) {
      mbr[i] = 0x00;
    }

    // Partition Entry 1
    const partitionStart = 0x1be;
    mbr[partitionStart + 0] = 0x80;
    mbr[partitionStart + 1] = 0x01;
    mbr[partitionStart + 2] = 0x01;
    mbr[partitionStart + 3] = 0x00;
    mbr[partitionStart + 4] = 0x0c;
    mbr[partitionStart + 5] = 0xfe;
    mbr[partitionStart + 6] = 0xff;
    mbr[partitionStart + 7] = 0xff;

    const lbaStart = 2048;
    mbr[partitionStart + 8] = lbaStart & 0xff;
    mbr[partitionStart + 9] = (lbaStart >> 8) & 0xff;
    mbr[partitionStart + 10] = (lbaStart >> 16) & 0xff;
    mbr[partitionStart + 11] = (lbaStart >> 24) & 0xff;

    const numSectors = 61440;
    mbr[partitionStart + 12] = numSectors & 0xff;
    mbr[partitionStart + 13] = (numSectors >> 8) & 0xff;
    mbr[partitionStart + 14] = (numSectors >> 16) & 0xff;
    mbr[partitionStart + 15] = (numSectors >> 24) & 0xff;

    for (let i = 1; i < 4; i++) {
      for (let j = 0; j < 16; j++) {
        mbr[0x1be + i * 16 + j] = 0x00;
      }
    }

    mbr[510] = 0x55;
    mbr[511] = 0xaa;

    disk.set(mbr, 0);

    // Tạo Boot Sector FAT32
    const bootSector = new Uint8Array(512);
    bootSector[0] = 0xeb;
    bootSector[1] = 0x58;
    bootSector[2] = 0x90;

    const oemId = "MSWIN4.1";
    for (let i = 0; i < oemId.length; i++) {
      bootSector[3 + i] = oemId.charCodeAt(i);
    }

    bootSector[0x0b] = 0x00;
    bootSector[0x0c] = 0x02;
    bootSector[0x0d] = 0x08;
    bootSector[0x0e] = 0x20;
    bootSector[0x0f] = 0x00;
    bootSector[0x10] = 0x02;
    bootSector[0x11] = 0x00;
    bootSector[0x12] = 0x00;
    bootSector[0x13] = 0x00;
    bootSector[0x14] = 0x00;
    bootSector[0x15] = 0xf8;
    bootSector[0x16] = 0x00;
    bootSector[0x17] = 0x00;
    bootSector[0x20] = numSectors & 0xff;
    bootSector[0x21] = (numSectors >> 8) & 0xff;
    bootSector[0x22] = (numSectors >> 16) & 0xff;
    bootSector[0x23] = (numSectors >> 24) & 0xff;
    bootSector[0x24] = 0xef;
    bootSector[0x25] = 0x00;
    bootSector[0x26] = 0x00;
    bootSector[0x27] = 0x00;
    bootSector[0x2c] = 0x02;
    bootSector[0x2d] = 0x00;
    bootSector[0x2e] = 0x00;
    bootSector[0x2f] = 0x00;
    bootSector[0x30] = 0x01;
    bootSector[0x31] = 0x00;
    bootSector[0x32] = 0x06;
    bootSector[0x33] = 0x00;
    bootSector[510] = 0x55;
    bootSector[511] = 0xaa;

    const partitionOffset = lbaStart * 512;
    disk.set(bootSector, partitionOffset);

    // Backup MBR CHỈ KHI CHỌN
    if (withBackup) {
      const backupMbrOffset = (diskSize / 512 - 1) * 512;
      disk.set(mbr, backupMbrOffset);

      // SỬA LỖI: Sao chép an toàn
      const safeMbr = new Uint8Array(mbr);

      setBackupMbr(safeMbr);
      setHasBackup(true);
      addLog(
        "Đã tạo ổ đĩa với BACKUP MBR (giả lập công cụ partition)",
        "success"
      );
    } else {
      setBackupMbr(null);
      setHasBackup(false);
      addLog("Đã tạo ổ đĩa KHÔNG CÓ backup MBR (như thực tế)", "success");
    }

    // SỬA LỖI: Sao chép an toàn
    const safeDisk = new Uint8Array(disk);
    setDiskImage(safeDisk);

    // SỬA LỖI: Sao chép an toàn
    const safeMbrData = new Uint8Array(mbr);
    setMbrData(safeMbrData);

    // Lưu thông tin boot sector để có thể tái tạo
    setBootSectors([
      {
        sector: lbaStart,
        oem: "MSWIN4.1",
        type: "FAT32",
        totalSectors: numSectors,
        sectorsPerCluster: 8,
        bytesPerSector: 512,
      },
    ]);

    const info = {
      bootable: mbr[0x1be] === 0x80,
      partitionType: mbr[0x1be + 4],
      lbaStart: lbaStart,
      numSectors: numSectors,
      sizeInMB: (numSectors * 512) / (1024 * 1024),
    };
    setPartitionInfo(info);

    addLog(
      `Partition: LBA=${lbaStart}, Sectors=${numSectors}, Type=0x0C (FAT32)`,
      "info"
    );
  };

  const loadExternalDisk = async (file: File | null) => {
    if (!file) return;
    addLog(
      `Loading external disk image: ${file.name} (${file.size} bytes)`,
      "info"
    );
    try {
      const buffer = await file.arrayBuffer();
      addLog(`File arrayBuffer received: ${buffer.byteLength} bytes`, "info");

      if (buffer.byteLength === 0) {
        addLog("Error: File is empty!", "error");
        return;
      }

      // SỬA LỖI: Sao chép an toàn
      const arr = new Uint8Array(buffer);
      const safeCopy = new Uint8Array(arr); // Đây là bản sao an toàn, độc lập

      // Validate MBR signature in loaded file
      const mbrSig = `${safeCopy[510]
        ?.toString(16)
        .padStart(2, "0")}${safeCopy[511]?.toString(16).padStart(2, "0")}`;
      addLog(`MBR Signature in file: 0x${mbrSig}`, "info");

      // Calculate and display checksum
      const checksumLoaded = calculateChecksum(safeCopy);
      addLog(`Loaded file checksum: 0x${checksumLoaded.toString(16)}`, "info");

      // Check if it looks like valid disk image
      if (safeCopy.length < 1024) {
        addLog(
          `Warning: File is very small (${safeCopy.length} bytes)`,
          "warning"
        );
      }

      // Check for common patterns
      if (safeCopy[510] !== 0x55 || safeCopy[511] !== 0xaa) {
        addLog(
          `Warning: Invalid MBR signature! Got 0x${mbrSig}, expected 0x55aa`,
          "warning"
        );
      }

      setDiskImage(safeCopy); // Set state với bản sao an toàn

      // SỬA LỖI: Sao chép an toàn (dùng slice)
      const mbrCopy = safeCopy.slice(0, 512);

      setMbrData(mbrCopy);
      setBackupMbr(null);
      setHasBackup(false);
      setBootSectors([]);
      setExternalFileName(file.name);
      addLog(`✓ Loaded ${file.name} (${safeCopy.length} bytes)`, "success");

      // If sector 0 looks like an MBR, populate partitionInfo
      if (
        safeCopy.length >= 512 &&
        safeCopy[510] === 0x55 &&
        safeCopy[511] === 0xaa
      ) {
        const numSectors =
          safeCopy[0x1be + 12] |
          (safeCopy[0x1be + 13] << 8) |
          (safeCopy[0x1be + 14] << 16) |
          (safeCopy[0x1be + 15] << 24);

        const info = {
          bootable: safeCopy[0x1be] === 0x80,
          partitionType: safeCopy[0x1be + 4],
          lbaStart:
            safeCopy[0x1be + 8] |
            (safeCopy[0x1be + 9] << 8) |
            (safeCopy[0x1be + 10] << 16) |
            (safeCopy[0x1be + 11] << 24),
          numSectors: numSectors,
          sizeInMB: (numSectors * 512) / (1024 * 1024),
        };
        setPartitionInfo(info);
        addLog("Detected partition info from MBR sector", "info");
      } else {
        addLog(
          "No valid MBR signature in sector 0 - will scan for boot sectors",
          "warning"
        );
        // Try to find boot sectors automatically
        const found = searchBootSectors();
        if (found && found.length > 0) {
          addLog("Found Boot Sector(s) in loaded image", "success");
        }
      }
    } catch (err) {
      addLog(`Failed to load image: ${err}`, "error");
    }
  };

  const onExternalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) loadExternalDisk(f);
  };

  const corruptPartitionTable = (): Uint8Array | null => {
    if (!diskImage || !mbrData) {
      addLog("Chưa tạo ổ đĩa ảo!", "error");
      return null;
    }

    // SỬA LỖI: Sao chép an toàn
    const corrupted = new Uint8Array(mbrData); // Bắt đầu bằng MBR hiện tại

    switch (errorType) {
      case "wrong_lba":
        corrupted[0x1be + 8] = 0xff;
        corrupted[0x1be + 9] = 0xff;
        addLog("Đã gây lỗi: LBA Start sai", "warning");
        break;
      case "wrong_size":
        corrupted[0x1be + 12] = 0x00;
        corrupted[0x1be + 13] = 0x00;
        addLog("Đã gây lỗi: Số sector sai", "warning");
        break;
      case "wrong_type":
        corrupted[0x1be + 4] = 0x00;
        addLog("Đã gây lỗi: Partition Type sai", "warning");
        break;
      case "no_signature":
        corrupted[510] = 0x00;
        corrupted[511] = 0x00;
        addLog("Đã gây lỗi: Mất MBR signature", "warning");
        break;
      case "all_zero":
        for (let i = 0x1be; i < 0x1fe; i++) {
          corrupted[i] = 0x00;
        }
        addLog("Đã gây lỗi: Xóa toàn bộ Partition Table", "warning");
        break;
      default:
        addLog("Chọn loại lỗi để gây lỗi", "error");
        return null;
    }

    // SỬA LỖI: Sao chép an toàn
    const newDisk = new Uint8Array(diskImage);
    newDisk.set(corrupted, 0); // Ghi đè MBR hỏng lên bản sao
    setDiskImage(newDisk);
    setMbrData(corrupted);
    setPartitionInfo(null);
    addLog(
      "MBR đã bị hỏng - hệ thống sẽ không nhận diện được phân vùng",
      "error"
    );
    return corrupted;
  };

  const searchBackupMbr = () => {
    if (!diskImage) {
      addLog("Không có disk image để tìm kiếm!", "error");
      return;
    }

    addLog("Bắt đầu tìm kiếm backup MBR...", "info");

    const diskSize = diskImage.length;
    // Offsets are in bytes. scan last sector and some common early sectors (1,2,2048)
    const sectorsToScan = [
      diskSize - 512, // last sector (bytes)
      512, // sector 1 (bytes)
      1024, // sector 2 (bytes)
      2048 * 512, // sector 2048 (bytes)
    ];

    let foundBackup = null;
    let foundAt = -1;

    for (const offset of sectorsToScan) {
      if (offset < 0 || offset + 512 > diskSize) continue;

      // SỬA LỖI: Sao chép an toàn (dùng slice)
      const sector = diskImage.slice(offset, offset + 512);

      if (sector[510] === 0x55 && sector[511] === 0xaa) {
        const bootFlag = sector[0x1be];
        const partType = sector[0x1be + 4];
        if ((bootFlag === 0x00 || bootFlag === 0x80) && partType !== 0x00) {
          // 'sector' đã là một bản sao độc lập
          foundBackup = sector;
          foundAt = Math.floor(offset / 512);
          addLog(`✓ Tìm thấy backup MBR tại sector ${foundAt}`, "success");
          break;
        }
      }
    }

    if (!foundBackup) {
      addLog("✗ KHÔNG tìm thấy backup MBR!", "error");
      addLog("Sẽ thử phương pháp tái tạo từ Boot Sector...", "warning");
      return false;
    }

    return { data: foundBackup, sector: foundAt };
  };

  const searchBootSectors = () => {
    if (!diskImage) {
      addLog("Không có disk image!", "error");
      return;
    }

    addLog("Đang quét tìm Boot Sector...", "info");

    const found = [];
    const diskSize = diskImage.length;
    const totalSectors = diskSize / 512;

    // Quét các vị trí phổ biến
    const scanPositions = [63, 2048, 4096, 8192];

    // Thêm quét mỗi 2048 sectors
    for (let s = 0; s < totalSectors; s += 2048) {
      if (!scanPositions.includes(s)) {
        scanPositions.push(s);
      }
    }

    for (const sector of scanPositions) {
      const offset = sector * 512;
      if (offset + 512 > diskSize) continue;

      // SỬA LỖI: Sao chép an toàn (dùng slice)
      const data = diskImage.slice(offset, offset + 512);

      // Kiểm tra signature
      if (data[510] !== 0x55 || data[511] !== 0xaa) continue;

      // Kiểm tra jump instruction
      if (data[0] !== 0xeb && data[0] !== 0xe9) continue;

      // Kiểm tra OEM ID
      const oem = String.fromCharCode(...data.slice(3, 11)).replace(/\0/g, "");
      if (
        !oem.includes("MSWIN") &&
        !oem.includes("MSDOS") &&
        !oem.includes("mkfs")
      ) {
        continue;
      }

      // Phân tích
      const bps = data[0x0b] | (data[0x0c] << 8);
      const spc = data[0x0d];
      const rootEntries = data[0x11] | (data[0x12] << 8);

      if (bps !== 512 && bps !== 1024 && bps !== 2048 && bps !== 4096) continue;

      let totalSec;
      let fsType;

      if (rootEntries === 0) {
        fsType = "FAT32";
        totalSec =
          data[0x20] |
          (data[0x21] << 8) |
          (data[0x22] << 16) |
          (data[0x23] << 24);
      } else {
        fsType = "FAT16";
        totalSec = data[0x13] | (data[0x14] << 8);
        if (totalSec === 0) {
          totalSec =
            data[0x20] |
            (data[0x21] << 8) |
            (data[0x22] << 16) |
            (data[0x23] << 24);
        }
      }

      if (totalSec > 0) {
        found.push({
          sector: sector,
          oem: oem.trim(),
          type: fsType,
          totalSectors: totalSec,
          sectorsPerCluster: spc,
          bytesPerSector: bps,
        });
        addLog(
          `✓ Tìm thấy Boot Sector ${fsType} tại sector ${sector}`,
          "success"
        );
      }
    }

    if (found.length === 0) {
      addLog("✗ Không tìm thấy Boot Sector nào!", "error");
      return null;
    }

    setBootSectors(found);
    return found;
  };

  const reconstructMbrFromBootSector = () => {
    if (bootSectors.length === 0) {
      addLog("Đang tìm Boot Sector...", "info");
      const found = searchBootSectors();
      if (!found || found.length === 0) {
        addLog("Không thể tái tạo MBR - không tìm thấy Boot Sector!", "error");
        return;
      }
    }

    addLog("Bắt đầu tái tạo MBR từ Boot Sector...", "info");

    const newMbr = new Uint8Array(512);

    // Boot code area (để trống)
    for (let i = 0; i < 446; i++) {
      newMbr[i] = 0x00;
    }

    // Tạo partition entries từ boot sectors
    bootSectors.slice(0, 4).forEach((bs, idx) => {
      const offset = 0x1be + idx * 16;

      // Boot flag
      newMbr[offset] = idx === 0 ? 0x80 : 0x00;

      // CHS start (LBA mode)
      newMbr[offset + 1] = 0xfe;
      newMbr[offset + 2] = 0xff;
      newMbr[offset + 3] = 0xff;

      // Partition type
      if (bs.type === "FAT32") {
        newMbr[offset + 4] = 0x0c;
      } else if (bs.type === "FAT16") {
        newMbr[offset + 4] = 0x0e;
      } else {
        newMbr[offset + 4] = 0x0b;
      }

      // CHS end (LBA mode)
      newMbr[offset + 5] = 0xfe;
      newMbr[offset + 6] = 0xff;
      newMbr[offset + 7] = 0xff;

      // LBA start
      const lba = bs.sector;
      newMbr[offset + 8] = lba & 0xff;
      newMbr[offset + 9] = (lba >> 8) & 0xff;
      newMbr[offset + 10] = (lba >> 16) & 0xff;
      newMbr[offset + 11] = (lba >> 24) & 0xff;

      // Number of sectors
      const numSec = bs.totalSectors;
      newMbr[offset + 12] = numSec & 0xff;
      newMbr[offset + 13] = (numSec >> 8) & 0xff;
      newMbr[offset + 14] = (numSec >> 16) & 0xff;
      newMbr[offset + 15] = (numSec >> 24) & 0xff;

      addLog(
        `Partition ${idx + 1}: ${bs.type} tại LBA ${lba}, ${numSec} sectors`,
        "info"
      );
    });

    // Signature
    newMbr[510] = 0x55;
    newMbr[511] = 0xaa;

    // Apply to disk - SỬA LỖI: Sao chép an toàn
    const newDisk = new Uint8Array(diskImage!);
    newDisk.set(newMbr, 0);
    setDiskImage(newDisk);
    setMbrData(newMbr); // newMbr đã là mảng mới, an toàn để set

    // Update partition info
    if (bootSectors.length > 0) {
      const bs = bootSectors[0];
      const info = {
        bootable: true,
        partitionType: bs.type === "FAT32" ? 0x0c : 0x0e,
        lbaStart: bs.sector,
        numSectors: bs.totalSectors,
        sizeInMB: (bs.totalSectors * 512) / (1024 * 1024),
      };
      setPartitionInfo(info);
    }

    addLog("✓ Đã tái tạo MBR thành công từ Boot Sector!", "success");
    addLog("MBR mới đã được tạo - partition có thể truy cập", "success");
  };

  const repairPartitionTable = () => {
    if (!diskImage) {
      addLog("Không tìm thấy disk image!", "error");
      return;
    }

    addLog("=== BẮT ĐẦU QUY TRÌNH KHẮC PHỤC ===", "info");

    // Phương pháp 1: Tìm backup MBR
    const backup = searchBackupMbr();

    if (backup) {
      addLog("Sử dụng phương pháp 1: Restore từ backup MBR", "success");
      // SỬA LỖI: Sao chép an toàn
      const restoredDisk = new Uint8Array(diskImage!);
      restoredDisk.set(backup.data, 0);
      setDiskImage(restoredDisk);

      // SỬA LỖI: Sao chép an toàn
      const mbrCopy = new Uint8Array(backup.data);
      setMbrData(mbrCopy);

      const numSectors =
        backup.data[0x1be + 12] |
        (backup.data[0x1be + 13] << 8) |
        (backup.data[0x1be + 14] << 16) |
        (backup.data[0x1be + 15] << 24);

      const info = {
        bootable: backup.data[0x1be] === 0x80,
        partitionType: backup.data[0x1be + 4],
        lbaStart:
          backup.data[0x1be + 8] |
          (backup.data[0x1be + 9] << 8) |
          (backup.data[0x1be + 10] << 16) |
          (backup.data[0x1be + 11] << 24),
        numSectors: numSectors,
        sizeInMB: (numSectors * 512) / (1024 * 1024),
      };
      setPartitionInfo(info);

      addLog("✓ Đã khôi phục MBR thành công từ backup!", "success");
      return;
    }

    // Phương pháp 2: Tái tạo từ Boot Sector
    addLog("Sử dụng phương pháp 2: Tái tạo từ Boot Sector", "warning");
    reconstructMbrFromBootSector();
  };

  const calculateChecksum = (data: Uint8Array): number => {
    let checksum = 0;
    // Tính checksum trên 1024 byte đầu tiên
    for (let i = 0; i < Math.min(1024, data.length); i++) {
      checksum = (checksum + data[i]) & 0xffffffff;
    }
    return checksum;
  };

  const exportDiskImage = () => {
    if (!diskImage) {
      addLog("Chưa có disk image để export!", "error");
      return;
    }

    try {
      addLog(`Exporting disk: size=${diskImage.length} bytes`, "info");

      if (diskImage.length === 0) {
        addLog("Error: diskImage is empty!", "error");
        return;
      }

      // 1. Kiểm tra Checksum trước khi export
      const checksumBefore = calculateChecksum(diskImage);
      addLog(`Pre-export checksum: 0x${checksumBefore.toString(16)}`, "info");
      addLog(
        `Pre-export MBR signature: 0x${diskImage[510]
          ?.toString(16)
          .padStart(2, "0")}${diskImage[511]?.toString(16).padStart(2, "0")}`,
        "info"
      );

      // 2. Tạo Blob (cách tối ưu)
      // Create an ArrayBuffer copy and pass that to Blob to satisfy TS and avoid SharedArrayBuffer typing issues
      const ab = diskImage.slice().buffer as unknown as ArrayBuffer;
      const blob = new Blob([ab], {
        type: "application/octet-stream",
      });

      if (blob.size !== diskImage.length) {
        addLog(
          `⚠️ Warning: Blob size (${blob.size}) doesn't match original (${diskImage.length})`,
          "warning"
        );
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Preserve loaded filename/extension if available (so .vhd exports remain .vhd)
      a.download = getExportFileName();

      // 3. SỬA LỖI: Thêm vào DOM để đảm bảo hoạt động
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 4. SỬA LỖI: Sửa lỗi typo và giữ thời gian chờ an toàn
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      addLog(`✓ Exported ${blob.size} bytes successfully`, "success");
    } catch (err) {
      addLog(`✗ Export failed: ${err}`, "error");
    }
  };

  const getHexDump = (
    data: Uint8Array | null,
    offset: number,
    length: number
  ): string => {
    if (!data) return "";
    // Slice cũng tạo ra bản sao an toàn
    const slice = data.slice(offset, offset + length);
    let dump = "";
    for (let i = 0; i < slice.length; i += 16) {
      const addr = (offset + i).toString(16).padStart(8, "0").toUpperCase();
      const bytes = Array.from(slice.slice(i, i + 16));
      const hex = bytes
        .map((b: number) => b.toString(16).padStart(2, "0").toUpperCase())
        .join(" ");
      const ascii = bytes
        .map((b: number) =>
          b >= 32 && b <= 126 ? String.fromCharCode(b) : "."
        )
        .join("");
      dump += `${addr}: ${hex.padEnd(48, " ")} ${ascii}\n`;
    }
    return dump;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">
              FAT32 Partition Error Simulator & Recovery
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">
                Load External Disk Image
              </h2>

              <div className="space-y-3">
                <input
                  type="file"
                  accept=".img,.bin,.vhd,.vhdx,application/octet-stream,*/*"
                  onChange={onExternalFileChange}
                  className="block w-full text-sm text-slate-200 file:bg-slate-700 file:text-white file:py-2 file:px-3 file:rounded-md"
                />

                {externalFileName && (
                  <div className="text-sm text-slate-300">
                    Loaded:{" "}
                    <span className="font-mono">{externalFileName}</span>
                  </div>
                )}

                <div className="text-xs text-slate-400">
                  Load a disk image (.img / .bin) to analyze and repair it with
                  the tool.
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Tạo Ổ Đĩa Ảo
              </h2>

              <div className="space-y-3">
                <button
                  onClick={() => createVirtualDisk(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm"
                >
                  ✓ Tạo ổ đĩa CÓ backup MBR
                </button>

                <button
                  onClick={() => createVirtualDisk(false)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm"
                >
                  ✗ Tạo ổ đĩa KHÔNG backup MBR
                </button>

                <div className="pt-3 border-t border-slate-600">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium">
                      Trạng thái backup:
                    </span>
                  </div>
                  <div
                    className={`text-sm px-3 py-2 rounded ${
                      hasBackup
                        ? "bg-green-900/30 text-green-400"
                        : "bg-red-900/30 text-red-400"
                    }`}
                  >
                    {hasBackup ? "✓ CÓ backup MBR" : "✗ KHÔNG có backup MBR"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">Gây Lỗi</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Loại lỗi
                  </label>
                  <select
                    value={errorType}
                    onChange={(e) => setErrorType(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="none">-- Chọn loại lỗi --</option>
                    <option value="wrong_lba">LBA Start sai</option>
                    <option value="wrong_size">Số sector sai</option>
                    <option value="wrong_type">Partition Type sai</option>
                    <option value="no_signature">Mất MBR signature</option>
                    <option value="all_zero">Xóa Partition Table</option>
                  </select>
                </div>

                <button
                  onClick={corruptPartitionTable}
                  disabled={!diskImage}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Gây lỗi Partition Table
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">Khắc Phục</h2>

              <div className="space-y-3">
                <button
                  onClick={repairPartitionTable}
                  disabled={!diskImage}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Tự động khắc phục
                  <div className="text-xs opacity-75 mt-1">
                    (Thử cả 2 phương pháp)
                  </div>
                </button>

                <button
                  onClick={searchBootSectors}
                  disabled={!diskImage}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Quét Boot Sector
                </button>

                <button
                  onClick={exportDiskImage}
                  disabled={!diskImage}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Image
                </button>
              </div>
            </div>

            {partitionInfo && (
              <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold mb-4">Thông tin Phân vùng</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bootable:</span>
                    <span className="font-mono">
                      {partitionInfo.bootable ? "Yes (0x80)" : "No (0x00)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="font-mono">
                      0x
                      {partitionInfo.partitionType
                        .toString(16)
                        .padStart(2, "0")
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">LBA Start:</span>
                    <span className="font-mono">{partitionInfo.lbaStart}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sectors:</span>
                    <span className="font-mono">
                      {partitionInfo.numSectors}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Size:</span>
                    <span className="font-mono">
                      {partitionInfo.sizeInMB.toFixed(2)} MB
                    </span>
                  </div>
                </div>
              </div>
            )}

            {bootSectors.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold mb-4">Boot Sectors</h2>
                <div className="space-y-3">
                  {bootSectors.map((bs, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-700/50 rounded p-3 text-sm"
                    >
                      <div className="font-semibold text-blue-400 mb-2">
                        Boot Sector #{idx + 1}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div>
                          Sector: <span className="font-mono">{bs.sector}</span>
                        </div>
                        <div>
                          Type: <span className="font-mono">{bs.type}</span>
                        </div>
                        <div>
                          OEM: <span className="font-mono">{bs.oem}</span>
                        </div>
                        <div>
                          Size:{" "}
                          <span className="font-mono">
                            {((bs.totalSectors * 512) / 1024 / 1024).toFixed(2)}{" "}
                            MB
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">
                MBR Hex Dump (Partition Table Area)
              </h2>
              {mbrData ? (
                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-green-400">
                    {getHexDump(mbrData, 0x1be, 66)}
                  </pre>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">
                  Chưa có dữ liệu MBR
                </p>
              )}
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">Activity Log</h2>
              <div className="bg-slate-900 rounded-lg p-4 h-80 overflow-y-auto space-y-2">
                {log.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">
                    Chưa có hoạt động
                  </p>
                ) : (
                  log.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {entry.type === "success" && (
                        <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      )}
                      {entry.type === "error" && (
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      {entry.type === "warning" && (
                        <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                      )}
                      {entry.type === "info" && (
                        <div className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      )}
                      <span className="text-slate-500">[{entry.time}]</span>
                      <span
                        className={
                          entry.type === "success"
                            ? "text-green-400"
                            : entry.type === "error"
                            ? "text-red-400"
                            : entry.type === "warning"
                            ? "text-yellow-400"
                            : "text-slate-300"
                        }
                      >
                        {entry.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAT32PartitionTool;
