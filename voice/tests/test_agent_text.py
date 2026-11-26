from agent.text import neutral, speakable, take_sentences


def test_speakable_strips_markdown_links_and_tags():
    assert speakable("See **[DocDesk](/work/docdesk)** on the Work page (/work). [[topic: projects; route: answered]]") == \
        "See DocDesk on the Work page."


def test_neutral_uses_the_name():
    assert neutral("He builds agents. His clients trust him.") == "Azad builds agents. Azad's clients trust Azad."
    assert neutral("The help desk helps.") == "The help desk helps."


def test_take_sentences_waits_for_complete_sentences():
    done, rest = take_sentences("You're booked with Dr. Rao at 4.15 pm tomorrow. Anything el")
    assert done == ["You're booked with Dr. Rao at 4.15 pm tomorrow."] and rest == "Anything el"
