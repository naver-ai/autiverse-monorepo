def ends_with_jongsung(text: str) -> bool:
    """
    Check if the text ends with a Korean final consonant (jongseong)
    
    Args:
        text (str): The text to check
        
    Returns:
        bool: True if the last character has a final consonant, False otherwise
    """
    if not text:
        return False
    
    for i in range(len(text) - 1, -1, -1):
        code = ord(text[i])
        # Check if it's within Korean syllable range (가-힣: 44032-55203)
        if 0xAC00 <= code <= 0xD7A3:
            jong = (code - 0xAC00) % 28
            return jong != 0  # If jong is 0, there's no final consonant
    
    return False  # Return False if no Korean characters


def escape_last_jongsung_from_korean_name(name: str) -> str:
    """
    Escape the last jongsung from a Korean name by adding "이"
    
    Args:
        name (str): The Korean name
        
    Returns:
        str: The name with "이" appended if it ends with jongsung
    """
    child_name = name
    if ends_with_jongsung(name):
        child_name = child_name + "이"
    return child_name


def ends_with_jongseong(text: str) -> bool:
    """
    Check if the last character of the text ends with a Korean final consonant (jongseong)
    
    Args:
        text (str): The text to check
        
    Returns:
        bool: True if the last character has a final consonant, False otherwise
    """
    if not text or len(text) == 0:
        return False
    
    last_char = text[-1]
    last_char_code = ord(last_char)
    
    # Check if it's within Korean syllable range (가-힣: 44032-55203)
    if 44032 <= last_char_code <= 55203:
        jongseong = (last_char_code - 44032) % 28
        return jongseong != 0  # If jongseong is 0, there's no final consonant
    
    return False  # Return False if not a Korean character


def append_josa(text: str, josa_with_jongseong: str, josa_without_jongseong: str) -> str:
    """
    Append appropriate Korean particle (josa) based on whether the text ends with a final consonant
    
    Args:
        text (str): The base text
        josa_with_jongseong (str): The particle to use when text ends with a final consonant
        josa_without_jongseong (str): The particle to use when text doesn't end with a final consonant
        
    Returns:
        str: The text with the appropriate particle appended
    """
    if not text:
        return text
    
    has_jongseong = ends_with_jongseong(text)
    return text + (josa_with_jongseong if has_jongseong else josa_without_jongseong)


def escape_jongseong(text: str) -> str:
    """
    Escape jongseong by adding "이" if the text ends with a final consonant
    
    Args:
        text (str): The text to process
        
    Returns:
        str: The text with "이" appended if it ends with jongseong
    """
    if not text:
        return text
    
    if ends_with_jongseong(text):
        return text + "이"
    return text