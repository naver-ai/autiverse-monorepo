import json
import os
from pathlib import Path
from typing import Dict, Any, Optional, Union
from backend.database.models import UserLocale
from backend.utils.environment import FilePaths

class I18nManager:
    """Internationalization manager for the backend"""
    
    def __init__(self):
        self.translations: Dict[str, Dict[str, Any]] = {}
        self._load_translations()
    
    def _load_translations(self):
        """Load translation files from data/i18n directory"""
        i18n_dir = FilePaths.get_i18n_dir_path()
        
        if not os.path.exists(i18n_dir):
            raise FileNotFoundError(f"i18n directory not found at {i18n_dir}")
        
        # Load translation files
        for translation_file in Path(i18n_dir).glob("*.json"):
            locale = translation_file.stem  # Get filename without extension
            
            # Map locale names to UserLocale enum values
            locale_mapping = {
                "en": "English",
                "kr": "Korean"
            }
            
            if locale in locale_mapping:
                with open(translation_file, 'r', encoding='utf-8') as f:
                    translations = json.load(f)
                    self.translations[locale_mapping[locale]] = translations
    
    def _get_nested_value(self, data: Dict[str, Any], key_path: str) -> Optional[Any]:
        """Get nested value from dictionary using dot notation with array index support"""
        keys = key_path.split('.')
        current = data
        
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            elif isinstance(current, list) and key.isdigit():
                # Handle array index access (e.g., "array.0.name")
                index = int(key)
                if 0 <= index < len(current):
                    current = current[index]
                else:
                    return None
            else:
                return None
        
        return current
    
    def t(self, key: str, locale: UserLocale, join_arrays: Optional[str] = None, **kwargs) -> str:
        """
        Translate a key to the specified locale
        
        Args:
            key: Translation key (e.g., "Journaling.AgentIntro.FirstVisitGreetingTemplate")
            locale: UserLocale enum value
            join_arrays: String to join array elements with (e.g., " " for space, "+" for plus)
            **kwargs: Variables to interpolate in the translation
            
        Returns:
            Translated string
        """
        try:
            locale_str = locale.value
            if locale_str not in self.translations:
                return key
            
            translation = self._get_nested_value(self.translations[locale_str], key)
            if translation is None:
                return key
            
            # Handle different types of translations
            if isinstance(translation, list):
                if join_arrays is not None:
                    # Join array elements with specified separator
                    translation = join_arrays.join(str(item) for item in translation)
                else:
                    # Default behavior: return first element
                    translation = translation[0] if translation else key
            elif not isinstance(translation, str):
                # Convert non-string values to string
                translation = str(translation)
            
            # Variable interpolation
            if kwargs:
                for var_name, var_value in kwargs.items():
                    placeholder = f"{{{var_name}}}"
                    translation = translation.replace(placeholder, str(var_value))
            
            return translation
            
        except Exception as e:
            # Fallback to key if translation fails
            return key
    
    def get_translation(self, key: str, locale: UserLocale, join_arrays: Optional[str] = None, **kwargs) -> str:
        """
        Alias for t() method for better readability
        """
        return self.t(key, locale, join_arrays=join_arrays, **kwargs)
    
    def has_translation(self, key: str, locale: UserLocale) -> bool:
        """
        Check if a translation key exists for the given locale
        
        Args:
            key: Translation key
            locale: UserLocale enum value
            
        Returns:
            True if translation exists, False otherwise
        """
        try:
            locale_str = locale.value
            if locale_str not in self.translations:
                return False
            
            translation = self._get_nested_value(self.translations[locale_str], key)
            return translation is not None
        except:
            return False

# Global instance
i18n_manager = I18nManager()

# Convenience functions
def t(key: str, locale: UserLocale, join_arrays: Optional[str] = None, **kwargs) -> str:
    """Global translation function"""
    return i18n_manager.t(key, locale, join_arrays=join_arrays, **kwargs)

def get_translation(key: str, locale: UserLocale, join_arrays: Optional[str] = None, **kwargs) -> str:
    """Global translation function (alias)"""
    return i18n_manager.get_translation(key, locale, join_arrays=join_arrays, **kwargs)

def has_translation(key: str, locale: UserLocale) -> bool:
    """Global function to check if translation exists"""
    return i18n_manager.has_translation(key, locale) 