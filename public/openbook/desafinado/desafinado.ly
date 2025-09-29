




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts








% this causes the variables to be defined...












% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "Desafinado" }
			\fill-line { \large \smaller \bold \larger "Slightly Out Of Tune" }
			\fill-line {
				"Lyrics by Newton Mendonca, Jon Hendricks, Jessie Cavanaugh"
				"Music by Antonio Carlos Jobim"
			}
			\fill-line {
				"Medium Bossa Nova"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
%	list of instruments can be found at
%	http://lilypond.org/doc/v2.11/Documentation/user/lilypond/MIDI-instruments#MIDI-instruments
%	\set ChordNames.midiInstrument = #"acoustic grand"

	\startChords
	\startSong

	\myMark "A"
	\startPart
	f1*2:maj7 | g:7.5- | \myEndLine
	g1:m7 | c2.:7 c4:7/bes | a1:m7.5- | d:7.9- | \myEndLine
	g:m7 | a:7.9- | d:7 | d:7.9- | \myEndLine
	g1*2:7.9- | ges:maj7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	f1*2:maj7 | g:7.5- | \myEndLine
	g1:m7 | c2.:7 c4:7/bes | a1:m7.5- | d:7.9- | \myEndLine
	g:m7 | bes2:m7 ees:7 | f1:maj7 | b2:m7.5- e:9- | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	a1:maj7 | bes:dim7 | b:m7 | e:7 | \myEndLine
	a | bes:dim7 | b:m7 | e:7 | \myEndLine
	a | fis:m7 | b:m7 | e:7 | \myEndLine
	c:maj7 | cis:dim7 | d:m7 | g:7 | \myEndLine
	g:m7 | fis:dim | g:7 | c2:7 c:7.5- | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	f1*2:maj7 | g:7.5- | \myEndLine
	g1:m7 | c2.:7 c4:7/bes | a1:m7.5- | d:7.9- | \myEndLine
	g:m7 | bes2:m ees:7 | f1:maj7 | d:m7 | \myEndLine
	g1*2:7 | bes1:m7 | ees:7.9 | \myEndLine
	g:7 | g2:m7 c:7 | f1*2:6 | \myEndLine
	\endPart

	\endSong
	\endChords
}


}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Allegro" 4 = 130
	\time 4/4
	\key f \major

%	list of instruments can be found at
%	http://lilypond.org/doc/v2.11/Documentation/user/lilypond/MIDI-instruments#MIDI-instruments
%	\set Staff.midiInstrument = #"flute"

	% part "A"
	r8 c4 d8 e4 f | e4. d8 cis4 d | f4. des8 des2~ | des1 |
	r8 d!4 e8 f4 g | f4. e8 dis4 e | c'4. ees,8 ees2~ | ees1 |
	r8 d c' bes a g4 bes8~ | bes4. a8 dis,4 e | fis8 a fis2 d4 | ees1 |
	r8 aes4 g8 f4 d | aes'4. g8 f4 d | f4. des8 des2~ | des r |

	% part "A"
	r8 c4 d8 e4 f | e4. d8 cis4 d | f4. des8 des2~ | des1 |
	r8 d!4 e8 f4 g | f4. e8 dis4 e | c'4. ees,8 ees2~ | ees1 |
	r8 c'4 bes8 a g4 bes8~ | bes4. a8 g4 f | g8 f g2.~ | g2 r |

	% part "B"
	e4 fis e8 fis4 e8~ | e4. d8 cis4 d | e1~ | e2 r4 cis |
	e fis e8 fis4 e8~ | e4. d8 cis4 d | e4. b8 e2~ | e1 |
	r8 e4 fis8 gis4 a | b4. a8 cis,4 d | e8 fis e fis e2~ | e r4 e |
	g a g a | g f e f | g d8 g~ g d g4~ | g r r8 d g a |
	bes4 a bes a | c bes a bes | g1~ | g4 r r2 |

	% part "A"
	r8 c,4 d8 e4 f | e4. d8 cis4 d | f4. des8 des2~ | des1 |
	r8 d!4 e8 f4 g | f4. e8 dis4 e | d' des c b | bes! d r a |
	c4. b8 bes4 a | bes a g f | a2. e4 | g2. d8 e |
	f f f f f4 f | r8 d4 e8 f4 f | f8 f f f c'4 bes~ | bes2. d,8 e |
	f f f f f4 e8 f~ | f4 r8 e dis4 e | g4. f8 f2~ | f1 |
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {
	Love is like a nev -- er end -- ing mel -- o -- dy; __
	po -- ets have com -- pared it to a sym -- pho -- ny, __
	a sym -- pho -- ny con -- duc -- ted by the light -- ing of the moon,
	but our song of love is Slight -- ly Out Of Tune. __

	Once your kiss -- es raised me to a fev -- er pitch, __
	now the orch -- es -- tra -- tion does -- n't seem so rich. __
	Seems to me you've changed __ the tune we used to sing; __

	like the Bos -- sa No -- va, love should swing. __
	We used to har -- mo -- nize __ two souls in per -- fect time. __
	Now the song is dif -- f'rent and the words don't e -- ven rhyme, __
	'cause you for -- got the mel -- o -- dy our hearts would al -- ways croon, __
	and so what good's a heart that's Slight -- ly Out Of Tune. __

	Tune your heart to mine the way it uysed to be; __
	join with me in har -- mo -- ny and sing a song of lov -- ing.
	We're bound to get in tune a -- gain be -- fore too long.
	There'll be no De -- sa -- fi -- na -- do when your heart be -- longs to me com -- plete -- ly. __
	Then you won't be Slight -- ly Out Of Tune, __ you'll sing a -- long with me. __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
%	list of instruments can be found at
%	http://lilypond.org/doc/v2.11/Documentation/user/lilypond/MIDI-instruments#MIDI-instruments
%	\set ChordNames.midiInstrument = #"acoustic grand"

	\startChords
	\startSong

	\myMark "A"
	\startPart
	f1*2:maj7 | g:7.5- | \myEndLine
	g1:m7 | c2.:7 c4:7/bes | a1:m7.5- | d:7.9- | \myEndLine
	g:m7 | a:7.9- | d:7 | d:7.9- | \myEndLine
	g1*2:7.9- | ges:maj7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	f1*2:maj7 | g:7.5- | \myEndLine
	g1:m7 | c2.:7 c4:7/bes | a1:m7.5- | d:7.9- | \myEndLine
	g:m7 | bes2:m7 ees:7 | f1:maj7 | b2:m7.5- e:9- | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	a1:maj7 | bes:dim7 | b:m7 | e:7 | \myEndLine
	a | bes:dim7 | b:m7 | e:7 | \myEndLine
	a | fis:m7 | b:m7 | e:7 | \myEndLine
	c:maj7 | cis:dim7 | d:m7 | g:7 | \myEndLine
	g:m7 | fis:dim | g:7 | c2:7 c:7.5- | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	f1*2:maj7 | g:7.5- | \myEndLine
	g1:m7 | c2.:7 c4:7/bes | a1:m7.5- | d:7.9- | \myEndLine
	g:m7 | bes2:m ees:7 | f1:maj7 | d:m7 | \myEndLine
	g1*2:7 | bes1:m7 | ees:7.9 | \myEndLine
	g:7 | g2:m7 c:7 | f1*2:6 | \myEndLine
	\endPart

	\endSong
	\endChords
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Allegro" 4 = 130
	\time 4/4
	\key f \major

%	list of instruments can be found at
%	http://lilypond.org/doc/v2.11/Documentation/user/lilypond/MIDI-instruments#MIDI-instruments
%	\set Staff.midiInstrument = #"flute"

	% part "A"
	r8 c4 d8 e4 f | e4. d8 cis4 d | f4. des8 des2~ | des1 |
	r8 d!4 e8 f4 g | f4. e8 dis4 e | c'4. ees,8 ees2~ | ees1 |
	r8 d c' bes a g4 bes8~ | bes4. a8 dis,4 e | fis8 a fis2 d4 | ees1 |
	r8 aes4 g8 f4 d | aes'4. g8 f4 d | f4. des8 des2~ | des r |

	% part "A"
	r8 c4 d8 e4 f | e4. d8 cis4 d | f4. des8 des2~ | des1 |
	r8 d!4 e8 f4 g | f4. e8 dis4 e | c'4. ees,8 ees2~ | ees1 |
	r8 c'4 bes8 a g4 bes8~ | bes4. a8 g4 f | g8 f g2.~ | g2 r |

	% part "B"
	e4 fis e8 fis4 e8~ | e4. d8 cis4 d | e1~ | e2 r4 cis |
	e fis e8 fis4 e8~ | e4. d8 cis4 d | e4. b8 e2~ | e1 |
	r8 e4 fis8 gis4 a | b4. a8 cis,4 d | e8 fis e fis e2~ | e r4 e |
	g a g a | g f e f | g d8 g~ g d g4~ | g r r8 d g a |
	bes4 a bes a | c bes a bes | g1~ | g4 r r2 |

	% part "A"
	r8 c,4 d8 e4 f | e4. d8 cis4 d | f4. des8 des2~ | des1 |
	r8 d!4 e8 f4 g | f4. e8 dis4 e | d' des c b | bes! d r a |
	c4. b8 bes4 a | bes a g f | a2. e4 | g2. d8 e |
	f f f f f4 f | r8 d4 e8 f4 f | f8 f f f c'4 bes~ | bes2. d,8 e |
	f f f f f4 e8 f~ | f4 r8 e dis4 e | g4. f8 f2~ | f1 |
}


}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1959 and 1962, Editora Musical Arapua, Sao Paulo, Brazil" }
	}
	\fill-line {
		\smaller \smaller { "1959 1962, Editora Musical Arapua, Sao Paulo, Brazil" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:21 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





