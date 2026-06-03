/**
 * Mục đích: Thanh ghi cấu hình module CMS: định nghĩa các module dữ liệu có sẵn (ví dụ: domain_links, email_templates)
 *           với nhãn hiển thị, biểu tượng, cột template và cột hiển thị ưu tiên.
 * Luồng xử lý: Định nghĩa interface CmsModuleConfig và mảng cmsModules tĩnh; xuất bảng tra cứu
 *              moduleByKey để truy cập nhanh theo khóa module.
 * Quan hệ: Được sử dụng bởi CmsPage và CsvImportModal để xác định siêu dữ liệu theo module.
 */
import { Globe, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface CmsModuleConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  templateColumns: string[];
  preferredColumns: string[];
}

export const cmsModules: CmsModuleConfig[] = [
  { 
    key: 'domain_links', 
    label: 'Link Domain', 
    icon: Globe, 
    templateColumns: ['url', 'domain', 'title', 'description', 'image_url'], 
    preferredColumns: ['url', 'domain', 'title', 'description', 'image_url'] 
  },
  { 
    key: 'email_templates', 
    label: 'Email CMS', 
    icon: Mail, 
    templateColumns: [], 
    preferredColumns: [] 
  },
];

export const moduleByKey = Object.fromEntries(cmsModules.map((module) => [module.key, module]));
