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
