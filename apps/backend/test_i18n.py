#!/usr/bin/env python3
"""
Test script for i18n functionality
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.utils.i18n import t, get_translation, has_translation
from backend.database.models import UserLocale

def test_i18n_functionality():
    """Test the i18n functionality with various scenarios"""
    
    print("=== i18n Test Results ===\n")
    
    # Test basic translations
    print("1. Basic translations:")
    print(f"English - Welcome: {t('Welcome to React', UserLocale.English)}")
    print(f"Korean - Welcome: {t('Welcome to React', UserLocale.Korean)}")
    print()
    
    # Test nested key translations
    print("2. Nested key translations:")
    print(f"English - Home.WriteDiary: {t('Home.WriteDiary', UserLocale.English)}")
    print(f"Korean - Home.WriteDiary: {t('Home.WriteDiary', UserLocale.Korean)}")
    print()
    
    # Test translations with variables
    print("3. Translations with variables:")
    child_name = "Alice"
    agent_name = "Buddy"
    location = "school"
    
    print(f"English - Agent intro: {t('Journaling.AgentIntro.FirstVisitGreetingTemplate', UserLocale.English, child_name=child_name, agent_name=agent_name)}")
    print(f"Korean - Agent intro: {t('Journaling.AgentIntro.FirstVisitGreetingTemplate', UserLocale.Korean, child_name=child_name, agent_name=agent_name)}")
    print()
    
    # Test people selection message with variables
    print("4. People selection message:")
    print(f"English - People selection: {t('Journaling.PresetSelection.PeopleSelectionMessageTemplate', UserLocale.English, location=location)}")
    print(f"Korean - People selection: {t('Journaling.PresetSelection.PeopleSelectionMessageTemplate', UserLocale.Korean, location=location)}")
    print()
    
    # Test non-existent keys
    print("5. Non-existent keys:")
    non_existent_key = "NonExistent.Key"
    print(f"English - Non-existent: {t(non_existent_key, UserLocale.English)}")
    print(f"Korean - Non-existent: {t(non_existent_key, UserLocale.Korean)}")
    print()
    
    # Test has_translation function
    print("6. Translation existence check:")
    print(f"English - 'Home.WriteDiary' exists: {has_translation('Home.WriteDiary', UserLocale.English)}")
    print(f"Korean - 'Home.WriteDiary' exists: {has_translation('Home.WriteDiary', UserLocale.Korean)}")
    print(f"English - 'NonExistent.Key' exists: {has_translation('NonExistent.Key', UserLocale.English)}")
    print()
    
    # Test more complex translations
    print("7. Complex translations:")
    print(f"English - Next step: {t('Journaling.PresetSelection.NextStepTemplate', UserLocale.English, count=3)}")
    print(f"Korean - Next step: {t('Journaling.PresetSelection.NextStepTemplate', UserLocale.Korean, count=3)}")
    print()
    
    # Test loading message
    print("8. Loading messages:")
    print(f"English - Loading: {t('Loading.DefaultMessage', UserLocale.English)}")
    print(f"Korean - Loading: {t('Loading.DefaultMessage', UserLocale.Korean)}")
    print()
    
    # Test chat messages
    print("9. Chat messages:")
    print(f"English - Send button: {t('Chat.SendButton', UserLocale.English)}")
    print(f"Korean - Send button: {t('Chat.SendButton', UserLocale.Korean)}")
    print()
    
    # Test user responses (array handling)
    print("10. User responses (array handling):")
    print(f"English - Yes responses (default): {t('Journaling.UserResponses.Yes', UserLocale.English)}")
    print(f"Korean - Yes responses (default): {t('Journaling.UserResponses.Yes', UserLocale.Korean)}")
    print(f"English - Yes responses (joined with space): {t('Journaling.UserResponses.Yes', UserLocale.English, join_arrays=' ')}")
    print(f"Korean - Yes responses (joined with space): {t('Journaling.UserResponses.Yes', UserLocale.Korean, join_arrays=' ')}")
    print(f"English - Yes responses (joined with comma): {t('Journaling.UserResponses.Yes', UserLocale.English, join_arrays=', ')}")
    print(f"Korean - Yes responses (joined with comma): {t('Journaling.UserResponses.Yes', UserLocale.Korean, join_arrays=', ')}")
    print()
    
    # Test array index access
    print("11. Array index access:")
    print(f"English - Yes response [0]: {t('Journaling.UserResponses.Yes.0', UserLocale.English)}")
    print(f"Korean - Yes response [0]: {t('Journaling.UserResponses.Yes.0', UserLocale.Korean)}")
    print(f"English - Yes response [1]: {t('Journaling.UserResponses.Yes.1', UserLocale.English)}")
    print(f"Korean - Yes response [1]: {t('Journaling.UserResponses.Yes.1', UserLocale.Korean)}")
    print()
    
    # Test button labels (array handling)
    print("12. Button labels (array handling):")
    print(f"English - Yes button: {t('ChatInput.ButtonLabels.Yes', UserLocale.English)}")
    print(f"Korean - Yes button: {t('ChatInput.ButtonLabels.Yes', UserLocale.Korean)}")
    print(f"English - No button: {t('ChatInput.ButtonLabels.No', UserLocale.English)}")
    print(f"Korean - No button: {t('ChatInput.ButtonLabels.No', UserLocale.Korean)}")
    print()
    
    print("=== Test completed ===")

if __name__ == "__main__":
    test_i18n_functionality() 